import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import type { Salon } from "@/lib/salons-data";

interface SalonService {
  id: string;
  title: string;
  durationMinutes: number;
  price: number;
}
interface SalonStaff {
  id: string;
  name: string;
  roleTitle: string;
  image: string | null;
}
interface SalonResponse {
  salon: Salon & {
    cancellationWindowHours: number;
    cancellationPolicy: string;
    depositType?: "none" | "fixed" | "percentage";
    depositValue?: number;
  };
  services: SalonService[];
}
interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isBooked: boolean;
}
interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
}

const dates = Array.from({ length: 5 }, (_, index) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + index);
  const parts = new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    month: "long",
  }).formatToParts(date);
  return {
    day:
      index === 0
        ? "امروز"
        : new Intl.DateTimeFormat("fa-IR", { weekday: "long" }).format(date),
    date: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    value: date.toISOString().slice(0, 10),
    dayOfWeek: (date.getDay() + 1) % 7,
  };
});

function formatPrice(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default function SalonProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<SalonResponse | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [staff, setStaff] = useState<SalonStaff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");
  const [reviewsError, setReviewsError] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedTime, setSelectedTime] = useState("");
  const [phone, setPhone] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [booked, setBooked] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [bookingPaymentStatus, setBookingPaymentStatus] = useState<
    "not_required" | "pending" | "paid" | "failed"
  >("not_required");
  const [bookingDepositAmount, setBookingDepositAmount] = useState(0);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");
  const service = useMemo(
    () =>
      data?.services.find((item) => item.id === selectedService) ??
      data?.services[0],
    [data?.services, selectedService],
  );
  const depositAmount = useMemo(() => {
    if (
      !service ||
      !data?.salon.depositType ||
      data.salon.depositType === "none"
    )
      return 0;
    const value = Number(data.salon.depositValue ?? 0);
    return data.salon.depositType === "percentage"
      ? Math.min(service.price, Math.floor((service.price * value) / 100))
      : Math.min(service.price, value);
  }, [data?.salon.depositType, data?.salon.depositValue, service]);
  const timeSlots = useMemo(
    () =>
      availability.filter(
        (slot) =>
          slot.dayOfWeek === dates[selectedDate].dayOfWeek &&
          slot.isAvailable &&
          !slot.isBooked,
      ),
    [availability, selectedDate],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    fetch(`/api/salons/${id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Salon not found");
        return (await response.json()) as SalonResponse;
      })
      .then((result) => {
        setData(result);
        setSelectedService(result.services[0]?.id ?? "");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setLoadError("اطلاعات این سالن در دسترس نیست.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setAvailabilityLoading(true);
    setAvailabilityError("");
    setSelectedTime("");
    const params = new URLSearchParams({ date: dates[selectedDate].value });
    if (selectedService) params.set("serviceId", selectedService);
    if (selectedStaff) params.set("staffId", selectedStaff);
    fetch(`/api/salons/${id}/availability?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          availability?: AvailabilitySlot[];
          message?: string;
        };
        if (!response.ok)
          throw new Error(result.message ?? "زمان‌های خالی در دسترس نیست");
        return result;
      })
      .then((result) => setAvailability(result.availability ?? []))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setAvailabilityError(
          reason instanceof Error
            ? reason.message
            : "زمان‌های خالی در دسترس نیست",
        );
      })
      .finally(() => setAvailabilityLoading(false));
    return () => controller.abort();
  }, [id, selectedDate, selectedService, selectedStaff]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const params = selectedService
      ? `?serviceId=${encodeURIComponent(selectedService)}`
      : "";
    fetch(`/api/salons/${id}/staff${params}`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          staff?: SalonStaff[];
        };
        if (!response.ok) return;
        setStaff(result.staff ?? []);
        setSelectedStaff((current) =>
          result.staff?.some((member) => member.id === current) ? current : "",
        );
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setStaff([]);
      });
    return () => controller.abort();
  }, [id, selectedService]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setReviewsLoading(true);
    setReviewsError("");
    fetch(`/api/salons/${id}/reviews`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          reviews?: Review[];
          message?: string;
        };
        if (!response.ok)
          throw new Error(result.message ?? "نظرات در دسترس نیست");
        return result;
      })
      .then((result) => setReviews(result.reviews ?? []))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setReviewsError(
          reason instanceof Error ? reason.message : "نظرات در دسترس نیست",
        );
      })
      .finally(() => setReviewsLoading(false));
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (authLoading || !id || user?.role !== "customer") return;
    fetch(`/api/favorites/${id}`)
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          favorite?: boolean;
        };
        if (!response.ok) return;
        setFavorite(result.favorite === true);
      })
      .catch(() => undefined);
  }, [authLoading, id, user?.id, user?.role]);

  const startPayment = async (createdBookingId: string) => {
    setPaymentError("");
    setPaymentLoading(true);
    try {
      const paymentResponse = await fetch("/api/payments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: createdBookingId,
          customerPhone: phone,
        }),
      });
      const paymentResult = (await paymentResponse
        .json()
        .catch(() => ({}))) as {
        message?: string;
        payment?: { paymentUrl?: string };
      };
      if (!paymentResponse.ok || !paymentResult.payment?.paymentUrl) {
        throw new Error(paymentResult.message ?? "شروع پرداخت انجام نشد");
      }
      window.location.assign(paymentResult.payment.paymentUrl);
    } catch (reason: unknown) {
      setPaymentError(
        reason instanceof Error ? reason.message : "شروع پرداخت انجام نشد",
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  const toggleFavorite = async () => {
    if (!user || user.role !== "customer") {
      navigate(`/login?next=${encodeURIComponent(`/salons/${id}`)}`);
      return;
    }
    setFavoriteLoading(true);
    setFavoriteError("");
    try {
      const response = await fetch(`/api/favorites/${id}`, {
        method: favorite ? "DELETE" : "PUT",
      });
      const result = (await response.json().catch(() => ({}))) as {
        favorite?: boolean;
        message?: string;
      };
      if (!response.ok)
        throw new Error(result.message ?? "تغییر علاقه‌مندی انجام نشد");
      setFavorite(result.favorite === true);
    } catch (reason: unknown) {
      setFavoriteError(
        reason instanceof Error ? reason.message : "تغییر علاقه‌مندی انجام نشد",
      );
    } finally {
      setFavoriteLoading(false);
    }
  };

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data || !service || !selectedTime) return;
    setBookingError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonId: data.salon.id,
          serviceId: service.id,
          staffId: selectedStaff || null,
          customerPhone: phone,
          appointmentDate: dates[selectedDate].value,
          appointmentTime: selectedTime,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        booking?: {
          id?: string;
          depositAmount?: number;
          paymentStatus?: "not_required" | "pending" | "paid" | "failed";
        };
      };
      if (!response.ok) {
        setBookingError(result.message ?? "ثبت رزرو انجام نشد");
        return;
      }
      const createdBookingId = result.booking?.id;
      const createdDepositAmount = Number(
        result.booking?.depositAmount ?? depositAmount,
      );
      const createdPaymentStatus =
        result.booking?.paymentStatus ??
        (createdDepositAmount > 0 ? "pending" : "not_required");
      setBookingId(createdBookingId ?? "");
      setBookingDepositAmount(createdDepositAmount);
      setBookingPaymentStatus(createdPaymentStatus);
      setPaymentError("");
      setBooked(true);
      if (
        createdBookingId &&
        createdDepositAmount > 0 &&
        createdPaymentStatus === "pending"
      ) {
        await startPayment(createdBookingId);
      }
    } catch {
      setBookingError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    }
  };

  if (loading)
    return (
      <div className="container flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        در حال دریافت اطلاعات سالن...
      </div>
    );
  if (loadError || !data)
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-destructive">
          {loadError || "سالن پیدا نشد"}
        </p>
        <Button asChild>
          <Link to="/salons">بازگشت به سالن‌ها</Link>
        </Button>
      </div>
    );
  const { salon } = data;

  return (
    <div className="container py-8">
      <Link
        to="/salons"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به سالن‌ها
      </Link>
      {(salon.description ||
        salon.address ||
        salon.phone ||
        salon.galleryImages?.length) && (
        <section className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            {salon.description && (
              <div>
                <h2 className="text-lg font-extrabold text-foreground">
                  درباره سالن
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                  {salon.description}
                </p>
                {(salon.address || salon.phone || salon.instagram) && (
                  <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                    {salon.address && <p>آدرس: {salon.address}</p>}
                    {salon.phone && <p>تلفن: {salon.phone}</p>}
                    {salon.instagram && <p>اینستاگرام: {salon.instagram}</p>}
                  </div>
                )}
              </div>
            )}
            {salon.galleryImages && salon.galleryImages.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {salon.galleryImages.map((image) => (
                  <img
                    key={image}
                    src={image}
                    alt="تصویر گالری سالن"
                    className="aspect-square w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="relative aspect-[16/8] overflow-hidden rounded-3xl">
            <img
              src={salon.image}
              alt={salon.name}
              className="h-full w-full object-cover"
            />
            <button
              onClick={toggleFavorite}
              disabled={favoriteLoading}
              className={`absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/90 backdrop-blur-sm transition-colors hover:text-primary ${favorite ? "text-primary" : "text-muted-foreground"}`}
              aria-label={
                favorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"
              }
            >
              <Heart className={`h-5 w-5 ${favorite ? "fill-current" : ""}`} />
            </button>
          </div>
          {favoriteError && (
            <p className="mt-2 text-xs text-destructive">{favoriteError}</p>
          )}
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-foreground md:text-3xl">
                  {salon.name}
                </h1>
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {salon.city}، {salon.area}
                </span>
                <span className="flex items-center gap-1 text-gold-700">
                  <Star className="h-4 w-4 fill-gold-500 text-gold-500" />
                  {salon.rating} ({salon.reviewCount} نظر)
                </span>
              </div>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              سالن تاییدشده نوبتو
            </span>
          </div>
          <div className="mt-8 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">تجربه مشتریان</p>
                <h2 className="mt-1 text-lg font-extrabold text-foreground">
                  نظرات درباره این سالن
                </h2>
              </div>
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            {reviewsLoading ? (
              <p className="mt-5 text-sm text-muted-foreground">
                در حال دریافت نظرات...
              </p>
            ) : reviewsError ? (
              <p className="mt-5 text-sm text-destructive">{reviewsError}</p>
            ) : reviews.length === 0 ? (
              <p className="mt-5 text-sm text-muted-foreground">
                هنوز نظری برای این سالن ثبت نشده است.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border-t border-border pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-foreground">
                        مشتری نوبتو
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatReviewDate(review.createdAt)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star
                          key={index}
                          className={`h-3.5 w-3.5 ${index < review.rating ? "fill-gold-500 text-gold-500" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    {review.comment && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {review.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {service && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">مبلغ خدمت</span>
              <span className="font-bold text-foreground">
                {formatPrice(service.price)} تومان
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">بیعانه قابل پرداخت</span>
              <span className="font-bold text-primary">
                {depositAmount > 0
                  ? `${formatPrice(depositAmount)} تومان`
                  : "بدون بیعانه"}
              </span>
            </div>
            {depositAmount > 0 && (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                پس از ثبت رزرو، پرداخت بیعانه از طریق درگاه انجام می‌شود.
              </p>
            )}
            {booked && (
              <div className="mt-4 rounded-xl bg-gold-50 p-3">
                <p className="text-sm font-bold text-gold-800">
                  رزرو ثبت شد؛ پرداخت بیعانه باقی مانده است.
                </p>
                <p className="mt-1 text-xs text-gold-700">
                  وضعیت:{" "}
                  {bookingPaymentStatus === "pending"
                    ? "در انتظار پرداخت"
                    : bookingPaymentStatus === "paid"
                      ? "پرداخت شده"
                      : "پرداخت لازم نیست"}
                </p>
                {bookingPaymentStatus === "pending" && (
                  <>
                    <Button
                      type="button"
                      disabled={paymentLoading || !bookingId}
                      onClick={() => void startPayment(bookingId)}
                      className="mt-3 w-full"
                    >
                      {paymentLoading
                        ? "در حال انتقال به درگاه..."
                        : paymentError
                          ? "تلاش مجدد پرداخت"
                          : "پرداخت بیعانه"}
                    </Button>
                    {paymentError && (
                      <p className="mt-3 text-xs leading-5 text-destructive">
                        {paymentError}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <aside className="h-fit rounded-3xl border border-border bg-card p-5 shadow-lg shadow-primary/5 lg:sticky lg:top-24">
          {booked ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <h2 className="mt-5 text-xl font-extrabold text-foreground">
                نوبت شما ثبت شد
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                نوبت {service?.title} در {dates[selectedDate].day}،{" "}
                {dates[selectedDate].date} {dates[selectedDate].month} ساعت{" "}
                {selectedTime} برای شما رزرو شد.
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/my-bookings">مشاهده رزروهای من</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    رزرو آنلاین نوبت
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold text-foreground">
                    خدمت موردنظر را انتخاب کنید
                  </h2>
                  <div className="mt-4 rounded-xl bg-secondary/70 px-4 py-3">
                    <p className="text-xs font-semibold text-foreground">
                      قوانین لغو رزرو
                    </p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                      {salon.cancellationPolicy} (
                      {new Intl.NumberFormat("fa-IR").format(
                        salon.cancellationWindowHours,
                      )}{" "}
                      ساعت)
                    </p>
                  </div>
                </div>
                <CalendarDays className="h-6 w-6 text-primary" />
              </div>
              <div className="mt-5 space-y-3">
                {data.services.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selectedService === item.id}
                    onClick={() => setSelectedService(item.id)}
                    className={`w-full rounded-2xl border p-4 text-right transition-all ${selectedService === item.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-foreground">
                        {item.title}
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {formatPrice(item.price)} تومان
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {item.durationMinutes} دقیقه
                    </div>
                  </button>
                ))}
              </div>
              {staff.length > 0 && (
                <div className="mt-6 border-t border-border pt-5">
                  <p className="mb-3 text-sm font-bold text-foreground">
                    انتخاب پرسنل (اختیاری)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={!selectedStaff}
                      onClick={() => setSelectedStaff("")}
                      className={`rounded-xl border px-3 py-3 text-right text-xs font-semibold ${!selectedStaff ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      فرقی ندارد
                    </button>
                    {staff.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        aria-pressed={selectedStaff === member.id}
                        onClick={() => setSelectedStaff(member.id)}
                        className={`rounded-xl border px-3 py-3 text-right ${selectedStaff === member.id ? "border-primary bg-primary/5" : "border-border"}`}
                      >
                        <span className="block text-xs font-bold text-foreground">
                          {member.name}
                        </span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {member.roleTitle}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-6 border-t border-border pt-5">
                <p className="mb-3 text-sm font-bold text-foreground">
                  انتخاب روز
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {dates.map((date, index) => (
                    <button
                      key={date.value}
                      type="button"
                      aria-pressed={selectedDate === index}
                      onClick={() => setSelectedDate(index)}
                      className={`rounded-xl border px-1 py-2 text-center ${selectedDate === index ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}
                    >
                      <span className="block text-[10px]">{date.day}</span>
                      <span className="mt-1 block text-sm font-bold">
                        {date.date}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <p className="mb-3 text-sm font-bold text-foreground">
                  ساعت‌های خالی
                </p>
                {availabilityLoading ? (
                  <p className="text-xs text-muted-foreground">
                    در حال دریافت زمان‌ها...
                  </p>
                ) : availabilityError ? (
                  <p className="text-xs text-destructive">
                    {availabilityError}
                  </p>
                ) : timeSlots.length === 0 ? (
                  <p className="rounded-xl bg-secondary px-3 py-3 text-xs text-muted-foreground">
                    برای این روز زمان خالی وجود ندارد.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.startTime}
                        type="button"
                        aria-pressed={selectedTime === slot.startTime}
                        onClick={() => setSelectedTime(slot.startTime)}
                        className={`rounded-lg border px-2 py-2 text-sm ${selectedTime === slot.startTime ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}
                      >
                        {slot.startTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <form
                onSubmit={submitBooking}
                className="mt-6 border-t border-border pt-5"
              >
                <label
                  htmlFor="booking-phone"
                  className="mb-2 block text-sm font-bold text-foreground"
                >
                  شماره موبایل
                </label>
                <Input
                  id="booking-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                  dir="ltr"
                  required
                />
                <Button
                  type="submit"
                  className="mt-4 w-full"
                  disabled={!service || !selectedTime || paymentLoading}
                >
                  {paymentLoading
                    ? "در حال آماده‌سازی پرداخت..."
                    : "تایید و رزرو نوبت"}
                </Button>
                {bookingError && (
                  <p className="mt-3 text-xs text-destructive">
                    {bookingError}
                  </p>
                )}
              </form>
              <div className="mt-5 flex items-start gap-2 rounded-xl bg-secondary/70 p-3 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                اطلاعات شما نزد نوبتو محفوظ می‌ماند.
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
