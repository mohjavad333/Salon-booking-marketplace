import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Coins,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface ReportData {
  rangeDays: number;
  summary: {
    totalBookings: number;
    confirmedBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowBookings: number;
    grossRevenue: number;
    averageTicket: number;
    uniqueCustomers: number;
    depositExpected: number;
    paidAmount: number;
    pendingAmount: number;
    refundedAmount: number;
    netPaidAmount: number;
    paymentCount: number;
  };
  services: Array<{ title: string; bookings: number; revenue: number }>;
  staff: Array<{
    name: string;
    bookings: number;
    completedBookings: number;
    revenue: number;
  }>;
  daily: Array<{
    date: string;
    bookings: number;
    revenue: number;
    depositExpected: number;
  }>;
  transactions: Array<{
    id: string;
    bookingId: string;
    provider: string;
    amount: number;
    paymentType: string;
    status: string;
    customerPhone: string;
    serviceTitle: string;
    createdAt: string;
  }>;
}
function formatPrice(value: number) {
  return `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

export default function OwnerReports() {
  const [days, setDays] = useState("30");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/owner/reports?days=${days}`);
      const result = (await response.json().catch(() => ({}))) as ReportData & {
        message?: string;
      };
      if (!response.ok)
        throw new Error(result.message ?? "گزارش‌ها در دسترس نیستند");
      setData(result);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "گزارش‌ها در دسترس نیستند",
      );
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  if (loading && !data)
    return (
      <div className="container flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        در حال آماده‌سازی گزارش‌ها...
      </div>
    );
  if (error && !data)
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button onClick={() => void loadReports()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          تلاش دوباره
        </Button>
      </div>
    );
  if (!data) return null;
  const cards = [
    {
      label: "کل رزروها",
      value: data.summary.totalBookings,
      icon: CalendarDays,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "درآمد ناخالص",
      value: formatPrice(data.summary.grossRevenue),
      icon: Coins,
      tone: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "مشتریان یکتا",
      value: data.summary.uniqueCustomers,
      icon: Users,
      tone: "bg-blue-100 text-blue-600",
    },
    {
      label: "میانگین سبد",
      value: formatPrice(data.summary.averageTicket),
      icon: BarChart3,
      tone: "bg-gold-100 text-gold-700",
    },
  ];
  const financialCards = [
    {
      label: "بیعانه مورد انتظار",
      value: formatPrice(data.summary.depositExpected),
      detail: "از رزروهای تاییدشده",
    },
    {
      label: "پرداخت‌شده",
      value: formatPrice(data.summary.paidAmount),
      detail: `${data.summary.paymentCount} تراکنش ثبت‌شده`,
    },
    {
      label: "در انتظار پرداخت",
      value: formatPrice(data.summary.pendingAmount),
      detail: "تراکنش‌های درگاه",
    },
    {
      label: "خالص پس از refund",
      value: formatPrice(data.summary.netPaidAmount),
      detail: `بازپرداخت: ${formatPrice(data.summary.refundedAmount)}`,
    },
  ];
  return (
    <div className="bg-secondary/30 py-8">
      <div className="container">
        <Link
          to="/dashboard"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت به داشبورد
        </Link>
        {error && data && (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{error} — اطلاعات قبلی نمایش داده می‌شود.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadReports()}
            >
              تلاش دوباره
            </Button>
          </div>
        )}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">تحلیل عملکرد سالن</p>
            <h1 className="mt-1 text-2xl font-extrabold text-foreground md:text-3xl">
              گزارش‌های سالن
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              تصمیم‌های بهتر با آمار رزرو و درآمد.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="report-days"
              className="text-xs text-muted-foreground"
            >
              بازه گزارش
            </label>
            <select
              id="report-days"
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="7">۷ روز اخیر</option>
              <option value="30">۳۰ روز اخیر</option>
              <option value="90">۹۰ روز اخیر</option>
              <option value="365">یک سال اخیر</option>
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}
              >
                <card.icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-xl font-extrabold text-foreground">
                {typeof card.value === "number"
                  ? new Intl.NumberFormat("fa-IR").format(card.value)
                  : card.value}
              </p>
            </div>
          ))}
        </div>
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-foreground">
                گزارش مالی
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                وضعیت درآمد و تراکنش‌های بازه {data.rangeDays} روزه
              </p>
            </div>
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {financialCards.map((card) => (
              <div key={card.label} className="rounded-xl bg-secondary/60 p-4">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="mt-2 text-lg font-extrabold text-foreground">
                  {card.value}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {card.detail}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 overflow-x-auto">
            <h3 className="mb-3 text-sm font-bold text-foreground">
              آخرین تراکنش‌ها
            </h3>
            {data.transactions.length === 0 ? (
              <p className="rounded-xl bg-secondary/50 px-4 py-8 text-center text-sm text-muted-foreground">
                هنوز تراکنشی برای این سالن ثبت نشده است.
              </p>
            ) : (
              <table className="w-full min-w-[720px] text-right text-xs">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="p-3 font-semibold">تاریخ</th>
                    <th className="p-3 font-semibold">مشتری</th>
                    <th className="p-3 font-semibold">خدمت</th>
                    <th className="p-3 font-semibold">نوع</th>
                    <th className="p-3 font-semibold">مبلغ</th>
                    <th className="p-3 font-semibold">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="p-3 text-muted-foreground">
                        {formatDate(transaction.createdAt.slice(0, 10))}
                      </td>
                      <td className="p-3 text-foreground">
                        {transaction.customerPhone}
                      </td>
                      <td className="p-3 text-foreground">
                        {transaction.serviceTitle}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {transaction.paymentType === "deposit"
                          ? "بیعانه"
                          : transaction.paymentType === "refund"
                            ? "بازگشت وجه"
                            : "کامل"}
                      </td>
                      <td className="p-3 font-bold text-foreground">
                        {formatPrice(transaction.amount)}
                      </td>
                      <td className="p-3">
                        <span className="rounded-full bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
                          {transaction.status === "paid"
                            ? "پرداخت‌شده"
                            : transaction.status === "pending"
                              ? "در انتظار"
                              : transaction.status === "refunded"
                                ? "بازگشت‌شده"
                                : "ناموفق"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-foreground">
              وضعیت رزروها
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">تکمیل‌شده</p>
                <p className="mt-2 text-xl font-extrabold text-emerald-800">
                  {data.summary.completedBookings.toLocaleString("fa-IR")}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-xs text-blue-700">تاییدشده</p>
                <p className="mt-2 text-xl font-extrabold text-blue-800">
                  {data.summary.confirmedBookings.toLocaleString("fa-IR")}
                </p>
              </div>
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-xs text-muted-foreground">لغوشده</p>
                <p className="mt-2 text-xl font-extrabold text-foreground">
                  {data.summary.cancelledBookings.toLocaleString("fa-IR")}
                </p>
              </div>
              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-xs text-red-700">عدم مراجعه</p>
                <p className="mt-2 text-xl font-extrabold text-red-800">
                  {data.summary.noShowBookings.toLocaleString("fa-IR")}
                </p>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-foreground">
              محبوب‌ترین خدمات
            </h2>
            {data.services.length === 0 ? (
              <p className="mt-5 text-sm text-muted-foreground">
                داده‌ای برای نمایش وجود ندارد.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-border">
                {data.services.map((service) => (
                  <div
                    key={service.title}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {service.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {service.bookings.toLocaleString("fa-IR")} رزرو
                      </p>
                    </div>
                    <span className="text-xs font-bold text-primary">
                      {formatPrice(service.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold text-foreground">
                      عملکرد پرسنل
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      مقایسه رزروهای تکمیل‌شده و درآمد هر پرسنل
                    </p>
                  </div>
                  <Users className="h-5 w-5 text-primary" />
                </div>
                {data.staff.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    هنوز داده‌ای برای عملکرد پرسنل وجود ندارد.
                  </p>
                ) : (
                  <div className="mt-5 space-y-4">
                    {data.staff.map((member) => {
                      const maxBookings = Math.max(
                        1,
                        ...data.staff.map((item) => item.bookings),
                      );
                      return (
                        <div
                          key={member.name}
                          className="rounded-xl border border-border p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-foreground">
                                {member.name}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {member.completedBookings} رزرو تکمیل‌شده از{" "}
                                {member.bookings}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-foreground">
                              {formatPrice(member.revenue)}
                            </p>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${Math.round((member.bookings / maxBookings) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
              <h2 className="text-lg font-extrabold text-foreground">
                روند روزانه رزروها
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                روزهایی که داده رزرو دارند نمایش داده شده‌اند.
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          {data.daily.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              در این بازه داده‌ای ثبت نشده است.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-right text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">تاریخ</th>
                    <th className="pb-3 font-medium">رزروها</th>
                    <th className="pb-3 font-medium">درآمد</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily
                    .slice(-14)
                    .reverse()
                    .map((day) => (
                      <tr
                        key={day.date}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-3 text-foreground">
                          {formatDate(day.date)}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {day.bookings.toLocaleString("fa-IR")}
                        </td>
                        <td className="py-3 font-semibold text-primary">
                          {formatPrice(day.revenue)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
