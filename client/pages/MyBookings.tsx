import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Heart,
  MapPin,
  RefreshCw,
  Star,
  UserCircle,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import type { Salon } from "@/lib/salons-data";

interface Booking {
  id: string;
  salonId: string;
  salonName: string;
  salonCity: string;
  salonArea: string;
  salonImage: string;
  serviceId: string;
  serviceTitle: string;
  staffName: string | null;
  price: number;
  totalAmount: number;
  depositAmount: number;
  paymentStatus: string;
  durationMinutes: number;
  customerPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  hasReview: boolean;
  createdAt: string;
}
type Filter = "all" | "upcoming" | "history";

const statusLabels: Record<string, { label: string; className: string }> = {
  confirmed: {
    label: "تایید شده",
    className: "bg-emerald-100 text-emerald-700",
  },
  pending: { label: "در انتظار تایید", className: "bg-gold-100 text-gold-800" },
  cancelled: {
    label: "لغو شده",
    className: "bg-secondary text-muted-foreground",
  },
  completed: { label: "تکمیل شده", className: "bg-blue-100 text-blue-700" },
  no_show: {
    label: "عدم حضور",
    className: "bg-destructive/10 text-destructive",
  },
};

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
}
function isUpcoming(booking: Booking) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    booking.appointmentDate >= today &&
    ["pending", "confirmed"].includes(booking.status)
  );
}

export default function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [favorites, setFavorites] = useState<Salon[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoritesError, setFavoritesError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentLoadingId, setPaymentLoadingId] = useState<string | null>(null);
  const [refundLoadingId, setRefundLoadingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  const loadBookings = useCallback(async () => {
    setError("");
    const response = await fetch("/api/bookings/me");
    const data = (await response.json().catch(() => ({}))) as {
      bookings?: Booking[];
      message?: string;
    };
    if (!response.ok) throw new Error(data.message ?? "رزروها در دسترس نیستند");
    setBookings(data.bookings ?? []);
  }, []);

  const loadFavorites = useCallback(async () => {
    setFavoritesError("");
    const response = await fetch("/api/favorites");
    const data = (await response.json().catch(() => ({}))) as {
      salons?: Salon[];
      message?: string;
    };
    if (!response.ok)
      throw new Error(data.message ?? "علاقه‌مندی‌ها در دسترس نیستند");
    setFavorites(data.salons ?? []);
  }, []);

  useEffect(() => {
    Promise.allSettled([loadBookings(), loadFavorites()]).then((results) => {
      if (results[0].status === "rejected")
        setError(
          results[0].reason instanceof Error
            ? results[0].reason.message
            : "رزروها در دسترس نیستند",
        );
      if (results[1].status === "rejected")
        setFavoritesError(
          results[1].reason instanceof Error
            ? results[1].reason.message
            : "علاقه‌مندی‌ها در دسترس نیستند",
        );
      setLoading(false);
    });
  }, [loadBookings, loadFavorites]);

  const visibleBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          filter === "all" ||
          (filter === "upcoming" ? isUpcoming(booking) : !isUpcoming(booking)),
      ),
    [bookings, filter],
  );

  const retry = async () => {
    setRetrying(true);
    try {
      await Promise.all([loadBookings(), loadFavorites()]);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "دریافت اطلاعات انجام نشد",
      );
    } finally {
      setRetrying(false);
    }
  };

  const cancelBooking = async (booking: Booking) => {
    if (!window.confirm("آیا از لغو این رزرو مطمئن هستید؟")) return;
    setActionError("");
    setActionLoading(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "لغو رزرو انجام نشد");
      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id ? { ...item, status: "cancelled" } : item,
        ),
      );
    } catch (reason: unknown) {
      setActionError(
        reason instanceof Error ? reason.message : "لغو رزرو انجام نشد",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const startReschedule = (booking: Booking) => {
    setActionError("");
    setEditingId(booking.id);
    setNewDate(booking.appointmentDate);
    setNewTime(booking.appointmentTime);
  };

  const startPayment = async (booking: Booking) => {
    setActionError("");
    setPaymentLoadingId(booking.id);
    try {
      const response = await fetch("/api/payments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          customerPhone: booking.customerPhone,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        payment?: { paymentUrl?: string };
      };
      if (!response.ok || !data.payment?.paymentUrl) {
        throw new Error(data.message ?? "شروع پرداخت انجام نشد");
      }
      window.location.assign(data.payment.paymentUrl);
    } catch (reason: unknown) {
      setActionError(
        reason instanceof Error ? reason.message : "شروع پرداخت انجام نشد",
      );
      setPaymentLoadingId(null);
    }
  };

  const requestRefund = async (booking: Booking) => {
    setActionError("");
    setRefundLoadingId(booking.id);
    try {
      const response = await fetch(
        `/api/payments/bookings/${booking.id}/refund`,
        {
          method: "POST",
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        paymentStatus?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "بازپرداخت انجام نشد");
      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id
            ? { ...item, paymentStatus: data.paymentStatus ?? "refunded" }
            : item,
        ),
      );
    } catch (reason: unknown) {
      setActionError(
        reason instanceof Error ? reason.message : "بازپرداخت انجام نشد",
      );
    } finally {
      setRefundLoadingId(null);
    }
  };

  const rescheduleBooking = async (booking: Booking) => {
    if (!newDate || !newTime) {
      setActionError("تاریخ و زمان جدید را انتخاب کنید.");
      return;
    }
    setActionError("");
    setActionLoading(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentDate: newDate,
          appointmentTime: newTime,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok)
        throw new Error(data.message ?? "تغییر زمان رزرو انجام نشد");
      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id
            ? { ...item, appointmentDate: newDate, appointmentTime: newTime }
            : item,
        ),
      );
      setEditingId(null);
    } catch (reason: unknown) {
      setActionError(
        reason instanceof Error ? reason.message : "تغییر زمان رزرو انجام نشد",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const removeFavorite = async (salonId: string) => {
    try {
      const response = await fetch(`/api/favorites/${salonId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("حذف علاقه‌مندی انجام نشد");
      setFavorites((current) =>
        current.filter((salon) => salon.id !== salonId),
      );
    } catch (reason: unknown) {
      setFavoritesError(
        reason instanceof Error ? reason.message : "حذف علاقه‌مندی انجام نشد",
      );
    }
  };

  const submitReview = async (booking: Booking) => {
    if (reviewRating === 0) {
      setReviewError("امتیاز خود را انتخاب کنید.");
      return;
    }
    setReviewError("");
    setReviewLoading(true);
    try {
      const response = await fetch(`/api/salons/${booking.salonId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "ثبت نظر انجام نشد");
      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id ? { ...item, hasReview: true } : item,
        ),
      );
      setReviewingId(null);
      setReviewRating(0);
      setReviewComment("");
    } catch (reason: unknown) {
      setReviewError(
        reason instanceof Error ? reason.message : "ثبت نظر انجام نشد",
      );
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading)
    return (
      <div className="container flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        در حال دریافت پنل مشتری...
      </div>
    );

  return (
    <div className="bg-secondary/30 py-8">
      <div className="container">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">حساب کاربری نوبتو</p>
            <h1 className="mt-1 text-2xl font-extrabold text-foreground md:text-3xl">
              پنل مشتری
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              رزروها، علاقه‌مندی‌ها و تجربه‌های خود را مدیریت کنید.
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link to="/salons">
              رزرو نوبت جدید <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserCircle className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">کاربر نوبتو</p>
                <p
                  className="mt-1 truncate text-xs text-muted-foreground"
                  dir="ltr"
                >
                  {user?.phone}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-2 border-t border-border pt-4">
              <Link
                to="/my-bookings"
                className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-bold text-primary"
              >
                رزروهای من <CalendarDays className="h-4 w-4" />
              </Link>
              <Link
                to="/salons"
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                جستجوی سالن‌ها <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </aside>
          <main>
            {error ? (
              <div className="rounded-2xl border border-destructive/20 bg-card p-8 text-center">
                <XCircle className="mx-auto h-10 w-10 text-destructive" />
                <h2 className="mt-4 text-lg font-extrabold text-foreground">
                  رزروها قابل دریافت نیستند
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                <Button
                  variant="outline"
                  onClick={retry}
                  disabled={retrying}
                  className="mt-5 gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {retrying ? "در حال تلاش..." : "تلاش دوباره"}
                </Button>
              </div>
            ) : (
              <>
                <section className="mb-6 rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        انتخاب‌های ذخیره‌شده
                      </p>
                      <h2 className="mt-1 text-lg font-extrabold text-foreground">
                        علاقه‌مندی‌های من
                      </h2>
                    </div>
                    <Heart className="h-5 w-5 text-primary" />
                  </div>
                  {favoritesError ? (
                    <p className="mt-4 text-sm text-destructive">
                      {favoritesError}
                    </p>
                  ) : favorites.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      هنوز سالنی به علاقه‌مندی‌ها اضافه نکرده‌اید.
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {favorites.map((salon) => (
                        <div
                          key={salon.id}
                          className="flex gap-3 rounded-xl border border-border p-3"
                        >
                          <img
                            src={salon.image}
                            alt={salon.name}
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/salons/${salon.id}`}
                              className="line-clamp-1 text-sm font-bold text-foreground hover:text-primary"
                            >
                              {salon.name}
                            </Link>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {salon.city}، {salon.area}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="flex items-center gap-1 text-xs text-gold-700">
                                <Star className="h-3 w-3 fill-gold-500 text-gold-500" />
                                {salon.rating}
                              </span>
                              <button
                                onClick={() => removeFavorite(salon.id)}
                                className="text-xs text-destructive hover:underline"
                              >
                                حذف
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2">
                  {(
                    [
                      ["all", "همه رزروها"],
                      ["upcoming", "پیش رو"],
                      ["history", "تاریخچه"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${filter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {visibleBookings.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-10 text-center">
                    <CalendarDays className="mx-auto h-10 w-10 text-primary/60" />
                    <h2 className="mt-4 text-lg font-extrabold text-foreground">
                      رزروی در این بخش ندارید
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      از بین سالن‌های نوبتو، زمان مناسب خود را انتخاب کنید.
                    </p>
                    <Button asChild className="mt-5">
                      <Link to="/salons">مشاهده سالن‌ها</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleBookings.map((booking) => {
                      const status = statusLabels[booking.status] ?? {
                        label: booking.status,
                        className: "bg-secondary text-muted-foreground",
                      };
                      const canManage = isUpcoming(booking);
                      return (
                        <article
                          key={booking.id}
                          className="overflow-hidden rounded-2xl border border-border bg-card"
                        >
                          <div className="flex flex-col gap-4 p-5 sm:flex-row">
                            <img
                              src={booking.salonImage}
                              alt={booking.salonName}
                              className="h-24 w-full rounded-xl object-cover sm:h-24 sm:w-32"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <h2 className="text-base font-extrabold text-foreground">
                                    {booking.salonName}
                                  </h2>
                                  <p className="mt-1 text-sm font-medium text-primary">
                                    {booking.serviceTitle}
                                  </p>
                                  {booking.staffName && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      پرسنل: {booking.staffName}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}
                                >
                                  {status.label}
                                </span>
                              </div>
                              <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                <span className="flex items-center gap-1.5">
                                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                                  {formatDate(booking.appointmentDate)}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Clock3 className="h-3.5 w-3.5 text-primary" />
                                  {booking.appointmentTime} ·{" "}
                                  {booking.durationMinutes} دقیقه
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-primary" />
                                  {booking.salonCity}، {booking.salonArea}
                                </span>
                                <span className="font-bold text-foreground">
                                  {formatPrice(booking.price)}
                                </span>
                                {booking.depositAmount > 0 && (
                                  <span className="font-semibold text-primary">
                                    بیعانه:{" "}
                                    {booking.paymentStatus === "paid"
                                      ? "پرداخت شده"
                                      : booking.paymentStatus === "refunded"
                                        ? "بازپرداخت شده"
                                        : booking.paymentStatus === "partially_paid"
                                          ? "بازپرداخت جزئی"
                                          : formatPrice(booking.depositAmount)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {(canManage ||
                            (booking.status === "cancelled" &&
                              booking.paymentStatus === "paid")) && (
                            <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
                              {canManage &&
                                booking.depositAmount > 0 &&
                                booking.paymentStatus !== "paid" && (
                                  <Button
                                    size="sm"
                                    onClick={() => startPayment(booking)}
                                    disabled={paymentLoadingId === booking.id}
                                    className="gap-2"
                                  >
                                    {paymentLoadingId === booking.id
                                      ? "در حال انتقال..."
                                      : "پرداخت بیعانه"}
                                  </Button>
                                )}
                              {booking.status === "cancelled" &&
                                booking.paymentStatus === "paid" && (
                                  <Button
                                    size="sm"
                                    onClick={() => requestRefund(booking)}
                                    disabled={refundLoadingId === booking.id}
                                    className="gap-2"
                                  >
                                    {refundLoadingId === booking.id
                                      ? "در حال بازپرداخت..."
                                      : "بازپرداخت بیعانه"}
                                  </Button>
                                )}
                              {canManage && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => startReschedule(booking)}
                                    className="gap-2"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    تغییر زمان
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => cancelBooking(booking)}
                                    disabled={actionLoading}
                                    className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    لغو رزرو
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                          {editingId === booking.id && (
                            <div className="border-t border-border bg-secondary/40 p-5">
                              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                                <RefreshCw className="h-4 w-4 text-primary" />
                                انتخاب زمان جدید
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label
                                    htmlFor={`date-${booking.id}`}
                                    className="mb-1.5 block text-xs text-muted-foreground"
                                  >
                                    تاریخ
                                  </label>
                                  <Input
                                    id={`date-${booking.id}`}
                                    type="date"
                                    value={newDate}
                                    onChange={(event) =>
                                      setNewDate(event.target.value)
                                    }
                                    dir="ltr"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`time-${booking.id}`}
                                    className="mb-1.5 block text-xs text-muted-foreground"
                                  >
                                    ساعت
                                  </label>
                                  <Input
                                    id={`time-${booking.id}`}
                                    type="time"
                                    value={newTime}
                                    onChange={(event) =>
                                      setNewTime(event.target.value)
                                    }
                                    dir="ltr"
                                  />
                                </div>
                              </div>
                              <div className="mt-4 flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => rescheduleBooking(booking)}
                                  disabled={actionLoading}
                                >
                                  {actionLoading
                                    ? "در حال ذخیره..."
                                    : "ذخیره زمان جدید"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingId(null)}
                                >
                                  انصراف
                                </Button>
                              </div>
                            </div>
                          )}
                          {booking.status === "completed" &&
                            (booking.hasReview ? (
                              <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm font-semibold text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" />
                                نظر شما ثبت شده است
                              </div>
                            ) : reviewingId === booking.id ? (
                              <div className="border-t border-border bg-secondary/40 p-5">
                                <p className="text-sm font-bold text-foreground">
                                  تجربه خود را درباره این سالن ثبت کنید
                                </p>
                                <div className="mt-3 flex gap-1" dir="ltr">
                                  {Array.from({ length: 5 }, (_, index) => (
                                    <button
                                      key={index}
                                      type="button"
                                      onClick={() => setReviewRating(index + 1)}
                                      aria-label={`${index + 1} ستاره`}
                                    >
                                      <Star
                                        className={`h-6 w-6 ${index < reviewRating ? "fill-gold-500 text-gold-500" : "text-muted-foreground/40"}`}
                                      />
                                    </button>
                                  ))}
                                </div>
                                <textarea
                                  value={reviewComment}
                                  onChange={(event) =>
                                    setReviewComment(event.target.value)
                                  }
                                  maxLength={500}
                                  placeholder="متن نظر (اختیاری)"
                                  className="mt-3 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                                />
                                <div className="mt-3 flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => submitReview(booking)}
                                    disabled={reviewLoading}
                                  >
                                    {reviewLoading
                                      ? "در حال ثبت..."
                                      : "ثبت نظر"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setReviewingId(null);
                                      setReviewError("");
                                    }}
                                  >
                                    انصراف
                                  </Button>
                                </div>
                                {reviewError && (
                                  <p className="mt-3 text-xs text-destructive">
                                    {reviewError}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="border-t border-border px-5 py-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setReviewingId(booking.id);
                                    setReviewRating(0);
                                    setReviewComment("");
                                    setReviewError("");
                                  }}
                                  className="gap-2"
                                >
                                  <Star className="h-3.5 w-3.5" />
                                  ثبت امتیاز و نظر
                                </Button>
                              </div>
                            ))}
                        </article>
                      );
                    })}
                  </div>
                )}
                {actionError && (
                  <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {actionError}
                  </p>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
