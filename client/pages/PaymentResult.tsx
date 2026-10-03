import { CheckCircle2, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

const messages = {
  success: {
    title: "پرداخت با موفقیت انجام شد",
    description:
      "بیعانه رزرو شما با موفقیت ثبت شد و وضعیت رزرو به‌روزرسانی شد.",
    icon: CheckCircle2,
    iconClassName: "text-emerald-600",
  },
  failed: {
    title: "پرداخت انجام نشد",
    description: "پرداخت تکمیل نشد. می‌توانید از پنل مشتری دوباره تلاش کنید.",
    icon: XCircle,
    iconClassName: "text-destructive",
  },
  error: {
    title: "بررسی پرداخت موقتاً ممکن نیست",
    description:
      "نتیجه پرداخت هنوز از سمت درگاه تأیید نشده است. چند دقیقه بعد وضعیت رزرو را بررسی کنید.",
    icon: XCircle,
    iconClassName: "text-gold-600",
  },
} as const;

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const status =
    searchParams.get("status") === "success"
      ? "success"
      : searchParams.get("status") === "error"
        ? "error"
        : "failed";
  const result = messages[status];
  const Icon = result.icon;

  return (
    <div className="container flex min-h-[65vh] items-center justify-center py-12">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
        <Icon className={`mx-auto h-16 w-16 ${result.iconClassName}`} />
        <h1 className="mt-6 text-2xl font-extrabold text-foreground">
          {result.title}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
          {result.description}
        </p>
        {searchParams.get("message") && status !== "success" && (
          <p className="mt-4 rounded-xl bg-secondary/70 px-4 py-3 text-xs text-muted-foreground">
            {searchParams.get("message")}
          </p>
        )}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/my-bookings">مشاهده رزروهای من</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/salons">بازگشت به سالن‌ها</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
