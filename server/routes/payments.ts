import type { RequestHandler } from "express";
import { getUserFromRequest } from "../auth";
import { databaseReady, pool } from "../db";
import {
  getPaymentCallbackUrl,
  getPaymentProvider,
  PaymentProviderError,
} from "../payment-provider";
import { startPaymentSchema } from "../validators/payments";

function getResultUrl(
  _req: Parameters<RequestHandler>[0],
  params: Record<string, string>,
) {
  const configuredBaseUrl = process.env.PUBLIC_APP_URL?.trim().replace(
    /\/$/,
    "",
  );
  const search = new URLSearchParams(params);
  return configuredBaseUrl
    ? `${configuredBaseUrl}/payment/result?${search.toString()}`
    : `/payment/result?${search.toString()}`;
}

async function markPaymentFailed(paymentId: string) {
  if (!pool) return;
  await pool.query(
    `UPDATE payments SET status = 'failed', updated_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [paymentId],
  );
}

export const handleStartPayment: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = startPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "اطلاعات پرداخت معتبر نیست" });
    return;
  }

  let provider;
  try {
    provider = getPaymentProvider();
  } catch (error: unknown) {
    res.status(503).json({
      message:
        error instanceof PaymentProviderError
          ? error.message
          : "درگاه پرداخت در دسترس نیست",
    });
    return;
  }

  let paymentId = "";
  try {
    await databaseReady;
    const user = await getUserFromRequest(req);
    const client = await pool.connect();
    let amount = 0;
    try {
      await client.query("BEGIN");
      const bookingResult = await client.query(
        `SELECT b.id, b.customer_id, b.customer_phone, b.deposit_amount, b.payment_status,
                b.status, s.name AS salon_name, v.title AS service_title
         FROM bookings b
         JOIN salons s ON s.id = b.salon_id
         JOIN services v ON v.id = b.service_id
         WHERE b.id = $1
         FOR UPDATE`,
        [parsed.data.bookingId],
      );
      if (!bookingResult.rowCount) {
        await client.query("ROLLBACK");
        res.status(404).json({ message: "رزرو پیدا نشد" });
        return;
      }
      const booking = bookingResult.rows[0];
      const hasAccess =
        (!booking.customer_id || booking.customer_id === user?.id) &&
        String(booking.customer_phone) === parsed.data.customerPhone;
      if (!hasAccess) {
        await client.query("ROLLBACK");
        res.status(403).json({ message: "اجازه پرداخت این رزرو را ندارید" });
        return;
      }
      if (!["pending", "confirmed"].includes(String(booking.status))) {
        await client.query("ROLLBACK");
        res.status(409).json({ message: "این رزرو دیگر قابل پرداخت نیست" });
        return;
      }
      if (
        Number(booking.deposit_amount) <= 0 ||
        String(booking.payment_status) === "not_required"
      ) {
        await client.query("ROLLBACK");
        res
          .status(400)
          .json({ message: "برای این رزرو مبلغی برای پرداخت وجود ندارد" });
        return;
      }
      if (String(booking.payment_status) === "paid") {
        await client.query("ROLLBACK");
        res.status(409).json({ message: "این رزرو قبلاً پرداخت شده است" });
        return;
      }
      await client.query(
        `UPDATE payments SET status = 'failed', updated_at = NOW()
         WHERE booking_id = $1 AND status = 'pending' AND updated_at < NOW() - INTERVAL '15 minutes'`,
        [parsed.data.bookingId],
      );
      const pendingPayment = await client.query(
        `SELECT id FROM payments WHERE booking_id = $1 AND status = 'pending' LIMIT 1`,
        [parsed.data.bookingId],
      );
      if (pendingPayment.rowCount) {
        await client.query("ROLLBACK");
        res
          .status(409)
          .json({ message: "برای این رزرو یک پرداخت در حال انجام است" });
        return;
      }
      amount = Number(booking.deposit_amount);
      const payment = await client.query(
        `INSERT INTO payments (booking_id, provider, amount, payment_type, status)
         VALUES ($1, $2, $3, 'deposit', 'pending')
         RETURNING id`,
        [parsed.data.bookingId, provider.name, amount],
      );
      paymentId = String(payment.rows[0].id);
      await client.query("COMMIT");
      const paymentRequest = await provider.createPayment({
        amount,
        description: `بیعانه رزرو ${String(booking.service_title)} در ${String(booking.salon_name)}`,
        callbackUrl: getPaymentCallbackUrl(req),
      });
      const paymentUpdate = await pool.query(
        `UPDATE payments SET provider_transaction_id = $1, updated_at = NOW()
         WHERE id = $2 AND status = 'pending'
         RETURNING id`,
        [paymentRequest.transactionId, paymentId],
      );
      if (!paymentUpdate.rowCount) {
        throw new PaymentProviderError("ثبت شناسه پرداخت در سیستم انجام نشد");
      }
      res.status(201).json({
        payment: {
          id: paymentId,
          amount,
          provider: provider.name,
          status: "pending",
          paymentUrl: paymentRequest.paymentUrl,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    if (error instanceof PaymentProviderError) {
      if (paymentId) await markPaymentFailed(paymentId);
      res.status(503).json({ message: error.message });
      return;
    }
    if (paymentId) await markPaymentFailed(paymentId);
    console.error(
      "Payment initiation failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "شروع پرداخت انجام نشد" });
  }
};

export const handlePaymentCallback: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const transactionId =
    typeof req.query.Authority === "string" ? req.query.Authority : "";
  const callbackStatus =
    typeof req.query.Status === "string" ? req.query.Status : "";
  if (!transactionId) {
    res.redirect(
      getResultUrl(req, {
        status: "failed",
        message: "شناسه تراکنش دریافت نشد",
      }),
    );
    return;
  }

  let provider;
  try {
    provider = getPaymentProvider();
  } catch (error: unknown) {
    res.redirect(
      getResultUrl(req, {
        status: "failed",
        message: "درگاه پرداخت پیکربندی نشده است",
      }),
    );
    return;
  }

  try {
    await databaseReady;
    const paymentResult = await pool.query(
      `SELECT p.id, p.booking_id, p.amount, p.status, b.deposit_amount
       FROM payments p JOIN bookings b ON b.id = p.booking_id
       WHERE p.provider = $1 AND p.provider_transaction_id = $2`,
      [provider.name, transactionId],
    );
    if (!paymentResult.rowCount) {
      res.redirect(
        getResultUrl(req, { status: "failed", message: "پرداخت پیدا نشد" }),
      );
      return;
    }
    const payment = paymentResult.rows[0];
    if (String(payment.status) === "paid") {
      res.redirect(
        getResultUrl(req, {
          status: "success",
          bookingId: String(payment.booking_id),
        }),
      );
      return;
    }
    if (callbackStatus.toUpperCase() !== "OK") {
      await markPaymentFailed(String(payment.id));
      res.redirect(
        getResultUrl(req, {
          status: "failed",
          bookingId: String(payment.booking_id),
          message: "پرداخت توسط کاربر لغو شد",
        }),
      );
      return;
    }

    const verification = await provider.verifyPayment({
      amount: Number(payment.amount),
      transactionId,
    });
    if (verification.status !== "paid") {
      await markPaymentFailed(String(payment.id));
      res.redirect(
        getResultUrl(req, {
          status: "failed",
          bookingId: String(payment.booking_id),
          message: "پرداخت تأیید نشد",
        }),
      );
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const lockedPayment = await client.query(
        `SELECT p.id, p.booking_id, p.status, b.deposit_amount
         FROM payments p JOIN bookings b ON b.id = p.booking_id
         WHERE p.id = $1 FOR UPDATE`,
        [payment.id],
      );
      if (!lockedPayment.rowCount)
        throw new Error("Payment disappeared during verification");
      if (String(lockedPayment.rows[0].status) !== "paid") {
        await client.query(
          `UPDATE payments SET status = 'paid', provider_reference_id = $2, updated_at = NOW()
           WHERE id = $1`,
          [payment.id, verification.referenceId ?? null],
        );
        await client.query(
          `UPDATE bookings b
           SET payment_status = CASE
             WHEN COALESCE((SELECT SUM(paid.amount) FROM payments paid
                            WHERE paid.booking_id = b.id
                              AND paid.status = 'paid'
                              AND paid.payment_type IN ('deposit', 'full')), 0) >= b.deposit_amount
             THEN 'paid' ELSE 'pending' END
           WHERE b.id = $1`,
          [payment.booking_id],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    res.redirect(
      getResultUrl(req, {
        status: "success",
        bookingId: String(payment.booking_id),
        referenceId: verification.referenceId ?? "",
      }),
    );
  } catch (error: unknown) {
    console.error(
      "Payment callback failed:",
      error instanceof Error ? error.message : error,
    );
    res.redirect(
      getResultUrl(req, {
        status: "error",
        bookingId: transactionId,
        message: "تأیید پرداخت موقتاً انجام نشد",
      }),
    );
  }
};
