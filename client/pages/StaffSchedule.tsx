import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, Save, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

const days = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const fallbackSlots = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30"];
interface Slot { startTime: string; endTime: string; isAvailable: boolean; }
interface StaffScheduleResponse { staff: { id: string; name: string }; availability: Array<Slot & { dayOfWeek: number }>; baseAvailability: Array<Slot & { dayOfWeek: number }>; }

function initialSlots() { return fallbackSlots.map((startTime) => ({ startTime, endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`, isAvailable: true })); }

export default function StaffSchedule() {
  const { staffId } = useParams();
  const [data, setData] = useState<StaffScheduleResponse | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [schedule, setSchedule] = useState<Record<number, Slot[]>>({ 0: initialSlots() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!staffId) return;
    fetch(`/api/owner/staff/${staffId}/availability`)
      .then(async (response) => { const result = (await response.json().catch(() => ({}))) as StaffScheduleResponse & { message?: string }; if (!response.ok) throw new Error(result.message ?? "تقویم پرسنل در دسترس نیست"); setData(result); const next: Record<number, Slot[]> = {}; for (let day = 0; day < 7; day += 1) { const custom = result.availability.filter((slot) => slot.dayOfWeek === day); const base = result.baseAvailability.filter((slot) => slot.dayOfWeek === day); next[day] = (custom.length > 0 ? custom : base).map(({ startTime, endTime, isAvailable }) => ({ startTime, endTime, isAvailable })); } setSchedule(next); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "تقویم پرسنل در دسترس نیست"))
      .finally(() => setLoading(false));
  }, [staffId]);

  const selectedSlots = schedule[selectedDay] ?? [];
  const hasCustomSchedule = useMemo(() => data?.availability.some((slot) => slot.dayOfWeek === selectedDay) ?? false, [data?.availability, selectedDay]);
  const toggleSlot = (index: number) => { setSaved(false); setSchedule((current) => ({ ...current, [selectedDay]: current[selectedDay].map((slot, slotIndex) => slotIndex === index ? { ...slot, isAvailable: !slot.isAvailable } : slot) })); };
  const closeAll = () => { setSaved(false); setSchedule((current) => ({ ...current, [selectedDay]: current[selectedDay].map((slot) => ({ ...slot, isAvailable: false })) })); };
  const saveChanges = async () => {
    if (!staffId) return;
    setSaving(true); setSaved(false); setSaveError("");
    try {
      const response = await fetch(`/api/owner/staff/${staffId}/availability`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dayOfWeek: selectedDay, slots: selectedSlots }) });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "ذخیره تقویم انجام نشد");
      setSaved(true);
    } catch (reason: unknown) { setSaveError(reason instanceof Error ? reason.message : "ذخیره تقویم انجام نشد"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="container flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">در حال دریافت تقویم پرسنل...</div>;
  if (error || !data) return <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center"><XCircle className="h-10 w-10 text-destructive" /><p className="text-sm text-destructive">{error || "پرسنل پیدا نشد"}</p><Button asChild><Link to="/dashboard/staff">بازگشت به پرسنل</Link></Button></div>;

  return <div className="bg-secondary/30 py-8"><div className="container max-w-5xl"><Link to="/dashboard/staff" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowRight className="h-4 w-4" />بازگشت به پرسنل</Link><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">تقویم اختصاصی تیم</p><h1 className="mt-1 text-2xl font-extrabold text-foreground md:text-3xl">تقویم {data.staff.name}</h1><p className="mt-2 text-sm text-muted-foreground">زمان‌های فعال این پرسنل را جدا از برنامه پایه سالن تنظیم کنید.</p></div><Button onClick={() => void saveChanges()} disabled={saving} className="gap-2"><Save className="h-4 w-4" />{saving ? "در حال ذخیره..." : "ذخیره تغییرات"}</Button></div>{saved && <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><Check className="h-4 w-4" />برنامه {days[selectedDay]} ذخیره شد.</div>}{saveError && <div className="mt-5 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{saveError}</div>}<div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between border-b border-border pb-5"><button onClick={() => setSelectedDay((day) => (day + 6) % 7)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary" aria-label="روز قبل"><ChevronRight className="h-4 w-4" /></button><div className="text-center"><p className="text-sm font-bold text-foreground">{days[selectedDay]}</p><p className="mt-1 text-xs text-muted-foreground">{hasCustomSchedule ? "برنامه اختصاصی" : "استفاده از برنامه پایه سالن"}</p></div><button onClick={() => setSelectedDay((day) => (day + 1) % 7)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary" aria-label="روز بعد"><ChevronLeft className="h-4 w-4" /></button></div><div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7">{days.map((day, index) => <button key={day} onClick={() => { setSelectedDay(index); setSaved(false); }} className={`rounded-xl border px-1 py-3 text-center ${selectedDay === index ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary"}`}><span className="block text-[11px]">{day}</span><span className="mt-1 block text-lg font-extrabold">{index + 1}</span></button>)}</div><div className="mt-8 grid gap-3 sm:grid-cols-2">{selectedSlots.map((slot, index) => <button key={`${slot.startTime}-${index}`} onClick={() => toggleSlot(index)} className={`flex items-center justify-between rounded-xl border p-4 text-right transition-colors ${slot.isAvailable ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/50 opacity-60"}`}><span className="flex items-center gap-2 text-sm font-bold text-foreground"><Clock3 className="h-4 w-4 text-primary" />{slot.startTime} تا {slot.endTime}</span><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${slot.isAvailable ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"}`}>{slot.isAvailable ? "فعال" : "بسته"}</span></button>)}{selectedSlots.length === 0 && <p className="col-span-full rounded-xl bg-secondary p-5 text-center text-sm text-muted-foreground">برای این روز برنامه‌ای در سالن تعریف نشده است.</p>}</div></section><aside className="h-fit rounded-2xl border border-border bg-card p-5"><h2 className="text-base font-extrabold text-foreground">ابزارهای روز</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">با بستن همه زمان‌ها، این پرسنل برای روز انتخاب‌شده قابل رزرو نخواهد بود.</p><Button variant="outline" onClick={closeAll} className="mt-5 w-full">بستن همه زمان‌ها</Button><div className="mt-5 rounded-xl bg-secondary/70 p-3 text-xs leading-5 text-muted-foreground">رزروهایی که بدون انتخاب پرسنل ثبت شوند، همچنان از ظرفیت عمومی سالن استفاده می‌کنند.</div></aside></div></div></div>;
}
