import type { Request } from "express";

export type PaymentVerification = {
  status: "paid" | "failed";
  referenceId?: string;
};

export type PaymentProvider = {
  name: string;
  createPayment(input: {
    amount: number;
    description: string;
    callbackUrl: string;
  }): Promise<{ transactionId: string; paymentUrl: string }>;
  verifyPayment(input: {
    amount: number;
    transactionId: string;
  }): Promise<PaymentVerification>;
  refundPayment(input: {
    amount: number;
    transactionId: string;
  }): Promise<{ status: "refunded" | "failed"; referenceId?: string }>;
};

export class PaymentProviderError extends Error {}

function getBaseUrl() {
  return process.env.ZARINPAL_SANDBOX === "true"
    ? "https://sandbox.zarinpal.com/pg/v4/payment"
    : "https://payment.zarinpal.com/pg/v4/payment";
}

function getMerchantId() {
  const merchantId = process.env.ZARINPAL_MERCHANT_ID?.trim();
  if (!merchantId)
    throw new PaymentProviderError("درگاه پرداخت هنوز پیکربندی نشده است");
  return merchantId;
}

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: Record<string, unknown>;
    errors?: unknown;
  } | null;
  if (!response.ok || !payload?.data) {
    throw new PaymentProviderError("ارتباط با درگاه پرداخت برقرار نشد");
  }
  return payload.data;
}

const zarinpalProvider: PaymentProvider = {
  name: "zarinpal",
  async createPayment({ amount, description, callbackUrl }) {
    const data = await postJson("/request.json", {
      merchant_id: getMerchantId(),
      amount: amount * 10,
      description,
      callback_url: callbackUrl,
    });
    const authority = String(data.authority ?? "");
    if (!authority)
      throw new PaymentProviderError("درگاه پرداخت شناسه تراکنش برنگرداند");
    const gatewayHost =
      process.env.ZARINPAL_SANDBOX === "true"
        ? "sandbox.zarinpal.com"
        : "www.zarinpal.com";
    return {
      transactionId: authority,
      paymentUrl: `https://${gatewayHost}/pg/StartPay/${encodeURIComponent(authority)}`,
    };
  },
  async verifyPayment({ amount, transactionId }) {
    const data = await postJson("/verify.json", {
      merchant_id: getMerchantId(),
      amount: amount * 10,
      authority: transactionId,
    });
    const code = Number(data.code);
    if (code === 100 || code === 101) {
      return { status: "paid", referenceId: String(data.ref_id ?? "") };
    }
    return { status: "failed" };
  },
  async refundPayment({ amount, transactionId }) {
    const data = await postJson("/reverseTransaction.json", {
      merchant_id: getMerchantId(),
      amount: amount * 10,
      authority: transactionId,
    });
    const code = Number(data.code);
    if (code === 100 || code === 101) {
      return {
        status: "refunded",
        referenceId: String(data.ref_id ?? data.authority ?? ""),
      };
    }
    return { status: "failed" };
  },
};

export function getPaymentProvider() {
  const provider = (process.env.PAYMENT_PROVIDER ?? "zarinpal")
    .trim()
    .toLowerCase();
  if (provider === "zarinpal") return zarinpalProvider;
  throw new PaymentProviderError("درگاه پرداخت انتخاب‌شده پشتیبانی نمی‌شود");
}

export function getPaymentCallbackUrl(_req: Request) {
  const configuredBaseUrl = process.env.PUBLIC_APP_URL?.trim().replace(
    /\/$/,
    "",
  );
  if (!configuredBaseUrl) {
    throw new PaymentProviderError(
      "PUBLIC_APP_URL برای callback پرداخت تنظیم نشده است",
    );
  }
  if (
    !configuredBaseUrl.startsWith("https://") &&
    process.env.ZARINPAL_SANDBOX !== "true"
  ) {
    throw new PaymentProviderError("PUBLIC_APP_URL باید با https شروع شود");
  }
  return `${configuredBaseUrl}/api/payments/callback`;
}
