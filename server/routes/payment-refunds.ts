import type { RequestHandler } from "express";
import { requireUser } from "../middleware/auth";
import { databaseReady, pool } from "../db";
import { getPaymentProvider, PaymentProviderError } from "../payment-provider";

export const handleRefundPayment: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
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

  const user = await requireUser(
    req,
    res,
    "برای درخواست بازپرداخت وارد حساب کاربری شوید",
  );
  if (!user) return;

  let refundId = "";
  let bookingId = req.params.bookingId;
  try {
    await databaseReady;
    const client = await pool.connect();
    let amount = 0;
    try {
      await client.query("BEGIN");
      const bookingResult = await client.query(
        `SELECT id, customer_id, status, payment_status
         FROM bookings
         WHERE id = $1
         FOR UPDATE`,
        [bookingId],
      );
      if (!bookingResult.rowCount) {
        await client.query("ROLLBACK");
        res.status(404).json({ message: "رزرو پیدا نشد" });
        return;
      }
      const booking = bookingResult.rows[0];
      if (String(booking.customer_id) !== user.id) {
        await client.query("ROLLBACK");
        res.status(403).json({ message: "اجازه بازپرداخت این رزرو را ندارید" });
        return;
      }
      if (String(booking.status) !== "cancelled") {
        await client.query("ROLLBACK");
        res
          .status(409)
          .json({ message: "بازپرداخت فقط برای رزرو لغوشده امکان‌پذیر است" });
        return;
      }
      const paidResult = await client.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE payment_type IN ('deposit', 'full') AND status = 'paid'), 0)::int AS paid_amount,
           COALESCE(SUM(amount) FILTER (WHERE payment_type = 'refund' AND status IN ('pending', 'refunded')), 0)::int AS refunded_amount
         FROM payments
         WHERE booking_id = $1`,
        [bookingId],
      );
      const paidAmount = Number(paidResult.rows[0].paid_amount);
      const refundedAmount = Number(paidResult.rows[0].refunded_amount);
      amount = paidAmount - refundedAmount;
      if (amount <= 0) {
        await client.query("ROLLBACK");
        res
          .status(409)
          .json({ message: "مبلغ قابل بازپرداختی برای این رزرو وجود ندارد" });
        return;
      }
      const originalPayment = await client.query(
        `SELECT provider_transaction_id
         FROM payments
         WHERE booking_id = $1 AND status = 'paid' AND payment_type IN ('deposit', 'full')
         ORDER BY created_at DESC
         LIMIT 1`,
        [bookingId],
      );
      const transactionId = String(
        originalPayment.rows[0]?.provider_transaction_id ?? "",
      );
      if (!transactionId) {
        await client.query("ROLLBACK");
        res
          .status(409)
          .json({ message: "شناسه تراکنش برای بازپرداخت پیدا نشد" });
        return;
      }
      const pendingRefund = await client.query(
        `SELECT id FROM payments
         WHERE booking_id = $1 AND payment_type = 'refund' AND status = 'pending'
         LIMIT 1`,
        [bookingId],
      );
      if (pendingRefund.rowCount) {
        await client.query("ROLLBACK");
        res
          .status(409)
          .json({ message: "درخواست بازپرداخت این رزرو در حال بررسی است" });
        return;
      }
      const refundResult = await client.query(
        `INSERT INTO payments (booking_id, provider, amount, payment_type, status)
         VALUES ($1, $2, $3, 'refund', 'pending')
         RETURNING id`,
        [bookingId, provider.name, amount],
      );
      refundId = String(refundResult.rows[0].id);
      await client.query("COMMIT");
      const refund = await provider.refundPayment({ amount, transactionId });
      if (refund.status !== "refunded") {
        await pool.query(
          `UPDATE payments SET status = 'failed', updated_at = NOW()
           WHERE id = $1 AND status = 'pending'`,
          [refundId],
        );
        res
          .status(502)
          .json({ message: "درخواست بازپرداخت توسط درگاه تأیید نشد" });
        return;
      }
      const refundUpdate = await pool.query(
        `UPDATE payments SET status = 'refunded', provider_reference_id = $2, updated_at = NOW()
         WHERE id = $1 AND status = 'pending'
         RETURNING id`,
        [refundId, refund.referenceId ?? null],
      );
      if (!refundUpdate.rowCount) {
        res
          .status(409)
          .json({ message: "وضعیت درخواست بازپرداخت تغییر کرده است" });
        return;
      }
      const paidAfterRefund = await pool.query(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE payment_type IN ('deposit', 'full') AND status = 'paid'), 0)::int AS paid_amount,
                COALESCE(SUM(amount) FILTER (WHERE payment_type = 'refund' AND status = 'refunded'), 0)::int AS refunded_amount
         FROM payments WHERE booking_id = $1`,
        [bookingId],
      );
      const fullyRefunded =
        Number(paidAfterRefund.rows[0].refunded_amount) >=
        Number(paidAfterRefund.rows[0].paid_amount);
      await pool.query(
        `UPDATE bookings SET payment_status = $2 WHERE id = $1`,
        [bookingId, fullyRefunded ? "refunded" : "partially_paid"],
      );
      res.json({
        refund: { id: refundId, amount, status: "refunded" },
        paymentStatus: fullyRefunded ? "refunded" : "partially_paid",
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    if (refundId && pool) {
      await pool
        .query(
          `UPDATE payments SET status = 'failed', updated_at = NOW()
         WHERE id = $1 AND status = 'pending'`,
          [refundId],
        )
        .catch(() => undefined);
    }
    console.error(
      "Payment refund failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({
      message:
        error instanceof PaymentProviderError
          ? error.message
          : "بازپرداخت انجام نشد",
    });
  }
};
