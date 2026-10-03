import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Save,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const baseDays = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];
const defaultSlots = [
  "09:00",
  "10:30",
  "12:00",
  "13:30",
  "15:00",
  "16:30",
  "18:00",
  "19:30",
];
interface Slot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}
interface Exception {
  date: string;
  isClosed: boolean;
  slots: Slot[];
}
interface Booking {
  id: string;
  customerPhone: string;
  serviceTitle: string;
  staffName: string | null;
  price: number;
  durationMinutes: number;
  appointmentDate: string;
  appointmentTime: string;
  endTime: string;
  status: string;
}
interface Staff {
  id: string;
  name: string;
  isActive: boolean;
}
interface Capacity {
  date: string;
  staffId: string;
  staffName: string;
  capacityMinutes: number;
  bookedMinutes: number;
  availableMinutes: number;
}
interface AvailabilityResponse {
  availability: Array<Slot & { dayOfWeek: number }>;
}
interface CalendarResponse {
  bookings: Booking[];
  capacity: Capacity[];
  message?: string;
}
interface StaffResponse {
  staff: Staff[];
  message?: string;
}
interface StaffAvailabilityResponse {
  availability: Array<Slot & { dayOfWeek: number }>;
  message?: string;
}

function toDateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function fromDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}
function getDayOfWeek(value: Date) {
  return (value.getDay() + 1) % 7;
}
function startOfWeek(value: Date) {
  const result = new Date(value);
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() - getDayOfWeek(result));
  return result;
}
function initialSchedule() {
  return Object.fromEntries(
    baseDays.map((_, index) => [
      index,
      defaultSlots.map((startTime) => ({
        startTime,
        endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
        isAvailable: true,
      })),
    ]),
  ) as Record<number, Slot[]>;
}
function cloneSlots(slots: Slot[]) {
  return slots.map((slot) => ({ ...slot }));
}
function formatPrice(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fromDateValue(value));
}
function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    month: "short",
  }).format(value);
}

export default function Schedule() {
  const navigate = useNavigate();
  const today = useMemo(() => toDateValue(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weeklySchedule, setWeeklySchedule] =
    useState<Record<number, Slot[]>>(initialSchedule);
  const [exceptions, setExceptions] = useState<Record<string, Exception>>({});
  const [exceptionSlots, setExceptionSlots] = useState<Slot[]>([]);
  const [exceptionClosed, setExceptionClosed] = useState(false);
  const [mode, setMode] = useState<"weekly" | "exception" | "staff-exception">(
    "weekly",
  );
  const [staffExceptions, setStaffExceptions] = useState<
    Record<string, Exception>
  >({});
  const [staffWeeklySchedule, setStaffWeeklySchedule] = useState<
    Record<number, Slot[]>
  >({});
  const [exceptionStaffId, setExceptionStaffId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [capacity, setCapacity] = useState<Capacity[]>([]);
  const [staffFilter, setStaffFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");

  const selectedDay = getDayOfWeek(fromDateValue(selectedDate));
  const selectedException =
    mode === "staff-exception"
      ? staffExceptions[selectedDate]
      : exceptions[selectedDate];
  const weekStart = useMemo(() => {
    const date = startOfWeek(fromDateValue(today));
    date.setDate(date.getDate() + weekOffset * 7);
    return date;
  }, [today, weekOffset]);
  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + index);
        return toDateValue(date);
      }),
    [weekStart],
  );
  const currentSlots =
    mode === "weekly" ? (weeklySchedule[selectedDay] ?? []) : exceptionSlots;
  const activeCount = currentSlots.filter((slot) => slot.isAvailable).length;
  const selectedBookings = bookings.filter(
    (booking) => booking.appointmentDate === selectedDate,
  );
  const selectedCapacity = capacity.filter(
    (item) => item.date === selectedDate,
  );
  const totalCapacityMinutes = selectedCapacity.reduce(
    (total, item) => total + item.capacityMinutes,
    0,
  );
  const totalBookedMinutes = selectedCapacity.reduce(
    (total, item) => total + item.bookedMinutes,
    0,
  );
  const weekLabel = `${formatShortDate(weekStart)} تا ${formatShortDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6))}`;

  useEffect(() => {
    if (!weekDates.includes(selectedDate)) setSelectedDate(weekDates[0]);
  }, [selectedDate, weekDates]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams({
      from: weekDates[0],
      to: weekDates[6],
    });
    if (staffFilter) params.set("staffId", staffFilter);
    if (statusFilter) params.set("status", statusFilter);
    Promise.all([
      fetch("/api/owner/availability", { signal: controller.signal }),
      fetch("/api/owner/availability/exceptions", {
        signal: controller.signal,
      }),
      fetch("/api/owner/staff", { signal: controller.signal }),
      fetch(`/api/owner/calendar?${params.toString()}`, {
        signal: controller.signal,
      }),
    ])
      .then(
        async ([
          availabilityResponse,
          exceptionResponse,
          staffResponse,
          calendarResponse,
        ]) => {
          const availabilityData = (await availabilityResponse
            .json()
            .catch(() => ({}))) as AvailabilityResponse & { message?: string };
          const exceptionData = (await exceptionResponse
            .json()
            .catch(() => ({}))) as {
            exceptions?: Exception[];
            message?: string;
          };
          const staffData = (await staffResponse
            .json()
            .catch(() => ({}))) as StaffResponse;
          const calendarData = (await calendarResponse
            .json()
            .catch(() => ({}))) as CalendarResponse;
          if (!active) return;
          if (
            [
              availabilityResponse,
              exceptionResponse,
              staffResponse,
              calendarResponse,
            ].some((response) => response.status === 401)
          ) {
            navigate(
              `/login?next=${encodeURIComponent("/dashboard/schedule")}`,
              { replace: true },
            );
            return;
          }
          if (!availabilityResponse.ok)
            throw new Error(
              availabilityData.message ?? "زمان‌بندی در دسترس نیست",
            );
          if (!exceptionResponse.ok)
            throw new Error(
              exceptionData.message ?? "استثناهای تقویم در دسترس نیستند",
            );
          if (!staffResponse.ok)
            throw new Error(staffData.message ?? "فهرست پرسنل در دسترس نیست");
          if (!calendarResponse.ok)
            throw new Error(
              calendarData.message ?? "رزروهای تقویم در دسترس نیستند",
            );
          if (availabilityData.availability.length > 0) {
            const next = Object.fromEntries(
              baseDays.map((_, index) => [index, []]),
            ) as Record<number, Slot[]>;
            availabilityData.availability.forEach(
              ({ dayOfWeek, startTime, endTime, isAvailable }) => {
                next[dayOfWeek].push({ startTime, endTime, isAvailable });
              },
            );
            setWeeklySchedule(next);
          }
          setExceptions(
            Object.fromEntries(
              (exceptionData.exceptions ?? []).map((item) => [item.date, item]),
            ),
          );
          setStaff(staffData.staff ?? []);
          setBookings(calendarData.bookings ?? []);
          setCapacity(calendarData.capacity ?? []);
        },
      )
      .catch((reason: unknown) => {
        if (
          !active ||
          (reason instanceof DOMException && reason.name === "AbortError")
        )
          return;
        setError(
          reason instanceof Error ? reason.message : "تقویم در دسترس نیست",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [navigate, weekDates, staffFilter, statusFilter]);

  useEffect(() => {
    if (!exceptionStaffId) {
      setStaffExceptions({});
      setStaffWeeklySchedule({});
      return;
    }
    Promise.all([
      fetch(
        `/api/owner/staff/${encodeURIComponent(exceptionStaffId)}/availability/exceptions`,
      ),
      fetch(
        `/api/owner/staff/${encodeURIComponent(exceptionStaffId)}/availability`,
      ),
    ])
      .then(async ([exceptionResponse, availabilityResponse]) => {
        const exceptionData = (await exceptionResponse
          .json()
          .catch(() => ({}))) as { exceptions?: Exception[]; message?: string };
        const availabilityData = (await availabilityResponse
          .json()
          .catch(() => ({}))) as StaffAvailabilityResponse;
        if (
          [exceptionResponse, availabilityResponse].some(
            (response) => response.status === 401,
          )
        ) {
          navigate(`/login?next=${encodeURIComponent("/dashboard/schedule")}`, {
            replace: true,
          });
          return null;
        }
        if (!exceptionResponse.ok)
          throw new Error(
            exceptionData.message ?? "استثناهای تقویم پرسنل در دسترس نیستند",
          );
        if (!availabilityResponse.ok)
          throw new Error(
            availabilityData.message ?? "برنامه هفتگی پرسنل در دسترس نیست",
          );
        return { exceptionData, availabilityData };
      })
      .then((data) => {
        if (!data) return;
        setStaffExceptions(
          Object.fromEntries(
            (data.exceptionData.exceptions ?? []).map((item) => [
              item.date,
              item,
            ]),
          ),
        );
        const next = Object.fromEntries(
          baseDays.map((_, index) => [index, []]),
        ) as Record<number, Slot[]>;
        data.availabilityData.availability.forEach(
          ({ dayOfWeek, startTime, endTime, isAvailable }) => {
            next[dayOfWeek].push({ startTime, endTime, isAvailable });
          },
        );
        setStaffWeeklySchedule(next);
      })
      .catch((reason: unknown) =>
        setSaveError(
          reason instanceof Error
            ? reason.message
            : "تقویم پرسنل در دسترس نیست",
        ),
      );
  }, [exceptionStaffId, navigate]);

  useEffect(() => {
    const exception =
      mode === "staff-exception"
        ? staffExceptions[selectedDate]
        : exceptions[selectedDate];
    setExceptionClosed(exception?.isClosed ?? false);
    const fallbackSlots =
      mode === "staff-exception"
        ? staffWeeklySchedule[selectedDay]
        : weeklySchedule[selectedDay];
    setExceptionSlots(
      exception ? cloneSlots(exception.slots) : cloneSlots(fallbackSlots ?? []),
    );
    setSaved(false);
    setSaveError("");
  }, [
    exceptions,
    selectedDate,
    selectedDay,
    staffExceptions,
    staffWeeklySchedule,
    weeklySchedule,
    mode,
  ]);

  const updateSlot = (index: number, patch: Partial<Slot>) => {
    const update = (slots: Slot[]) =>
      slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      );
    if (mode === "weekly")
      setWeeklySchedule((current) => ({
        ...current,
        [selectedDay]: update(current[selectedDay] ?? []),
      }));
    else setExceptionSlots(update);
    setSaved(false);
  };
  const removeSlot = (index: number) => {
    if (mode === "weekly")
      setWeeklySchedule((current) => ({
        ...current,
        [selectedDay]: (current[selectedDay] ?? []).filter(
          (_, slotIndex) => slotIndex !== index,
        ),
      }));
    else
      setExceptionSlots((current) =>
        current.filter((_, slotIndex) => slotIndex !== index),
      );
    setSaved(false);
  };
  const addSlot = () => {
    const source = currentSlots;
    const lastHour =
      source.length > 0
        ? Number(source[source.length - 1].startTime.slice(0, 2)) + 1
        : 9;
    const startTime = `${String(Math.min(lastHour, 23)).padStart(2, "0")}:00`;
    if (source.some((slot) => slot.startTime === startTime)) return;
    const newSlot = {
      startTime,
      endTime: `${String(Math.min(lastHour + 1, 23)).padStart(2, "0")}:00`,
      isAvailable: true,
    };
    if (mode === "weekly")
      setWeeklySchedule((current) => ({
        ...current,
        [selectedDay]: [...(current[selectedDay] ?? []), newSlot],
      }));
    else setExceptionSlots((current) => [...current, newSlot]);
    setSaved(false);
  };
  const closeAll = () => {
    if (mode === "weekly")
      setWeeklySchedule((current) => ({
        ...current,
        [selectedDay]: (current[selectedDay] ?? []).map((slot) => ({
          ...slot,
          isAvailable: false,
        })),
      }));
    else setExceptionClosed(true);
    setSaved(false);
  };
  const saveWeekly = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const response = await fetch("/api/owner/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek: selectedDay,
          slots: weeklySchedule[selectedDay] ?? [],
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok)
        throw new Error(data.message ?? "ذخیره برنامه هفتگی انجام نشد");
      setSaved(true);
    } catch (reason: unknown) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : "ذخیره برنامه هفتگی انجام نشد",
      );
    } finally {
      setSaving(false);
    }
  };
  const saveException = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const response = await fetch("/api/owner/availability/exceptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          isClosed: exceptionClosed,
          slots: exceptionClosed ? [] : exceptionSlots,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        exception?: Exception;
        message?: string;
      };
      if (!response.ok || !data.exception)
        throw new Error(data.message ?? "ذخیره برنامه این تاریخ انجام نشد");
      setExceptions((current) =>
        data.exception!.isClosed || data.exception!.slots.length > 0
          ? { ...current, [selectedDate]: data.exception! }
          : Object.fromEntries(
              Object.entries(current).filter(([date]) => date !== selectedDate),
            ),
      );
      setSaved(true);
    } catch (reason: unknown) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : "ذخیره برنامه این تاریخ انجام نشد",
      );
    } finally {
      setSaving(false);
    }
  };
  const saveStaffException = async () => {
    if (!exceptionStaffId) {
      setSaveError("ابتدا یک پرسنل را برای استثنا انتخاب کنید");
      return;
    }
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const response = await fetch(
        `/api/owner/staff/${encodeURIComponent(exceptionStaffId)}/availability/exceptions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            isClosed: exceptionClosed,
            slots: exceptionClosed ? [] : exceptionSlots,
          }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        exception?: Exception;
        message?: string;
      };
      if (!response.ok || !data.exception)
        throw new Error(data.message ?? "ذخیره استثنای پرسنل انجام نشد");
      setStaffExceptions((current) =>
        data.exception!.isClosed || data.exception!.slots.length > 0
          ? { ...current, [selectedDate]: data.exception! }
          : Object.fromEntries(
              Object.entries(current).filter(([date]) => date !== selectedDate),
            ),
      );
      setSaved(true);
    } catch (reason: unknown) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : "ذخیره استثنای پرسنل انجام نشد",
      );
    } finally {
      setSaving(false);
    }
  };
  const saveChanges = () =>
    mode === "weekly"
      ? saveWeekly()
      : mode === "exception"
        ? saveException()
        : saveStaffException();

  if (loading)
    return (
      <div className="container flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        در حال آماده‌سازی تقویم سالن...
      </div>
    );
  if (error)
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button asChild>
          <Link to="/dashboard">بازگشت به داشبورد</Link>
        </Button>
      </div>
    );

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              مدیریت حرفه‌ای زمان‌بندی
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-foreground md:text-3xl">
              تقویم و زمان‌های خالی
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              برای هر تاریخ برنامه هفتگی، تعطیلی یا زمان اختصاصی تعیین کنید.
            </p>
          </div>
          <Button
            onClick={() => void saveChanges()}
            disabled={saving}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
          </Button>
        </div>
        {saved && (
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <Check className="h-4 w-4" />
            تغییرات{" "}
            {mode === "weekly"
              ? `برنامه ${baseDays[selectedDay]}`
              : formatDate(selectedDate)}{" "}
            ذخیره شد.
          </div>
        )}
        {saveError && (
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <XCircle className="h-4 w-4" />
            {saveError}
          </div>
        )}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekOffset((value) => value - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary"
              aria-label="هفته قبل"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{weekLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                انتخاب تاریخ واقعی
              </p>
            </div>
            <button
              onClick={() => setWeekOffset((value) => value + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary"
              aria-label="هفته بعد"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {weekDates.map((date) => {
              const exception = exceptions[date];
              const isSelected = date === selectedDate;
              const isToday = date === today;
              return (
                <button
                  key={date}
                  onClick={() => {
                    setSelectedDate(date);
                    setMode("weekly");
                  }}
                  className={`rounded-xl border p-3 text-right transition-all ${isSelected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border text-foreground hover:border-primary"}`}
                >
                  <span
                    className={`block text-[11px] ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                  >
                    {baseDays[getDayOfWeek(fromDateValue(date))]}
                  </span>
                  <span className="mt-1 block text-lg font-extrabold">
                    {formatShortDate(fromDateValue(date))}
                  </span>
                  <span
                    className={`mt-2 block text-[10px] ${isSelected ? "text-primary-foreground/80" : exception?.isClosed ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {isToday
                      ? "امروز"
                      : exception?.isClosed
                        ? "تعطیل"
                        : exception
                          ? "برنامه خاص"
                          : "برنامه هفتگی"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                نمایش رزروهای بازه انتخاب‌شده
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-foreground">
                فیلتر و ظرفیت
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-muted-foreground">
                پرسنل
                <select
                  value={staffFilter}
                  onChange={(event) => setStaffFilter(event.target.value)}
                  className="mt-1 h-10 w-full min-w-44 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="">همه پرسنل</option>
                  {staff
                    .filter((member) => member.isActive)
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                وضعیت رزرو
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="mt-1 h-10 w-full min-w-44 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="">همه وضعیت‌ها</option>
                  <option value="pending">در انتظار</option>
                  <option value="confirmed">تأییدشده</option>
                  <option value="completed">تکمیل‌شده</option>
                  <option value="cancelled">لغوشده</option>
                  <option value="no_show">عدم مراجعه</option>
                </select>
              </label>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">
                ظرفیت کاری این روز
              </p>
              <p className="mt-1 text-lg font-extrabold text-foreground">
                {Math.round(totalCapacityMinutes / 60)} ساعت
              </p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">زمان رزروشده</p>
              <p className="mt-1 text-lg font-extrabold text-foreground">
                {Math.round(totalBookedMinutes / 60)} ساعت
              </p>
            </div>
            <div className="rounded-xl bg-primary/10 p-4">
              <p className="text-xs text-primary/80">ظرفیت باقی‌مانده</p>
              <p className="mt-1 text-lg font-extrabold text-primary">
                {Math.round(
                  Math.max(0, totalCapacityMinutes - totalBookedMinutes) / 60,
                )}{" "}
                ساعت
              </p>
            </div>
          </div>
          {selectedCapacity.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              برای این روز هنوز پرسنل فعال یا ظرفیت کاری ثبت نشده است.
            </p>
          )}
        </section>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(selectedDate)}
                </p>
                <h2 className="mt-1 text-xl font-extrabold text-foreground">
                  تنظیم برنامه
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeCount} زمان فعال ·{" "}
                  {selectedException?.isClosed
                    ? "این تاریخ تعطیل است"
                    : selectedException
                      ? "دارای برنامه استثنایی"
                      : "پیروی از برنامه هفتگی"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/70 p-1">
                <button
                  onClick={() => setMode("weekly")}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === "weekly" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
                >
                  برنامه هفتگی
                </button>
                <button
                  onClick={() => setMode("exception")}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === "exception" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
                >
                  استثنای این تاریخ
                </button>
                <button
                  onClick={() => {
                    setMode("staff-exception");
                    if (!exceptionStaffId)
                      setExceptionStaffId(
                        staff.find((member) => member.isActive)?.id ?? "",
                      );
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === "staff-exception" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
                >
                  استثنای پرسنل
                </button>
              </div>
            </div>
            {mode === "staff-exception" && (
              <div className="mt-5 rounded-xl bg-primary/5 px-4 py-3">
                <label className="text-xs font-semibold text-muted-foreground">
                  پرسنل موردنظر
                  <select
                    value={exceptionStaffId}
                    onChange={(event) => {
                      setExceptionStaffId(event.target.value);
                      setSaved(false);
                    }}
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  >
                    {staff
                      .filter((member) => member.isActive)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                  این تغییر فقط برنامه همین پرسنل را برای تاریخ انتخاب‌شده تغییر
                  می‌دهد.
                </p>
              </div>
            )}
            {(mode === "exception" || mode === "staff-exception") && (
              <div className="mt-5 flex items-center justify-between rounded-xl bg-secondary/70 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    تعطیلی کامل این تاریخ
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    هیچ slotی برای رزرو نمایش داده نمی‌شود.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setExceptionClosed((value) => !value);
                    setSaved(false);
                  }}
                  className={`relative h-7 w-12 rounded-full ${exceptionClosed ? "bg-destructive" : "bg-muted"}`}
                  aria-label="تعطیلی کامل تاریخ"
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${exceptionClosed ? "right-1" : "right-6"}`}
                  />
                </button>
              </div>
            )}
            {!exceptionClosed && (
              <>
                <div className="mt-5 flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">
                    زمان‌های قابل رزرو
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={closeAll}>
                      بستن همه
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addSlot}
                      className="gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      افزودن زمان
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {currentSlots.length === 0 ? (
                    <p className="rounded-xl bg-secondary/60 px-4 py-8 text-center text-sm text-muted-foreground">
                      برای این تاریخ زمانی تعریف نشده است.
                    </p>
                  ) : (
                    currentSlots.map((slot, index) => (
                      <div
                        key={`${slot.startTime}-${index}`}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3"
                      >
                        <button
                          onClick={() =>
                            updateSlot(index, {
                              isAvailable: !slot.isAvailable,
                            })
                          }
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${slot.isAvailable ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"}`}
                          aria-label={
                            slot.isAvailable ? "بستن زمان" : "فعال‌کردن زمان"
                          }
                        >
                          {slot.isAvailable ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Clock3 className="h-4 w-4" />
                          )}
                        </button>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(event) =>
                            updateSlot(index, { startTime: event.target.value })
                          }
                          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">
                          تا
                        </span>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(event) =>
                            updateSlot(index, { endTime: event.target.value })
                          }
                          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                        />
                        <button
                          onClick={() => removeSlot(index)}
                          className="mr-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="حذف زمان"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">
                    رزروهای این روز
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedBookings.length} رزرو ثبت‌شده
                  </p>
                </div>
              </div>
              <div className="mt-4 divide-y divide-border">
                {selectedBookings.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    برای این تاریخ رزروی وجود ندارد.
                  </p>
                ) : (
                  selectedBookings.map((booking) => (
                    <div key={booking.id} className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-foreground">
                          {booking.appointmentTime} تا {booking.endTime}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {booking.customerPhone}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {booking.serviceTitle}
                        {booking.staffName ? ` · ${booking.staffName}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-foreground">
                        {formatPrice(booking.price)} تومان
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">
                    راهنمای تقویم
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    برنامه سالن و استثناها
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-3 text-xs leading-6 text-muted-foreground">
                <li>
                  <strong className="text-foreground">برنامه هفتگی:</strong>{" "}
                  برای تمام هفته‌های آینده تکرار می‌شود.
                </li>
                <li>
                  <strong className="text-foreground">استثنای تاریخ:</strong>{" "}
                  تعطیلی یا زمان‌های این تاریخ را جایگزین می‌کند.
                </li>
                <li>
                  <strong className="text-foreground">حذف استثنا:</strong> در
                  حالت استثنا، همه زمان‌ها را حذف و ذخیره کنید.
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
