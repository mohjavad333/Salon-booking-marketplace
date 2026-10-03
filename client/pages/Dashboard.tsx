import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, CheckCircle2, Clock3, DollarSign, MoreHorizontal, Pencil, Plus, Scissors, Settings2, ShieldCheck, Star, Trash2, Users, XCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";

interface Salon { id: string; name: string; city: string; area: string; category: string; rating: number; reviewCount: number; startingPrice: number; image: string; description: string; address: string; phone: string | null; instagram: string | null; galleryImages: string[]; isActive: boolean; approvalStatus: string; }
interface Booking { id: string; customerPhone: string; serviceTitle: string; staffId: string | null; staffName: string | null; price: number; appointmentDate: string; appointmentTime: string; status: string; }
interface Service { id: string; title: string; durationMinutes: number; price: number; isActive: boolean; }
interface StaffMember { id: string; name: string; roleTitle: string; isActive: boolean; }
interface OwnerOverview { owner: { id: string; phone: string }; salon: Salon; stats: { todayBookings: number; pendingBookings: number; monthRevenue: number; customers: number }; bookings: Booking[]; services: Service[]; }

const statusLabels: Record<string, { label: string; className: string }> = { confirmed: { label: "تایید شده", className: "bg-emerald-100 text-emerald-700" }, pending: { label: "در انتظار", className: "bg-gold-100 text-gold-800" }, cancelled: { label: "لغو شده", className: "bg-secondary text-muted-foreground" }, completed: { label: "تکمیل شده", className: "bg-blue-100 text-blue-700" }, no_show: { label: "عدم مراجعه", className: "bg-red-100 text-red-700" } };
function formatPrice(value: number) { return new Intl.NumberFormat("fa-IR").format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat("fa-IR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`)); }

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<OwnerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [bookingStaffSaving, setBookingStaffSaving] = useState("");
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({ title: "", durationMinutes: "60", price: "" });
  const [editingSalon, setEditingSalon] = useState(false);
  const [salonForm, setSalonForm] = useState({ name: "", city: "", area: "", category: "", startingPrice: "", image: "", description: "", address: "", phone: "", instagram: "", galleryImages: "" });
  const [selectedTab, setSelectedTab] = useState("all");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [assignmentSaving, setAssignmentSaving] = useState("");
  const [assignmentError, setAssignmentError] = useState("");

  const loadDashboard = useCallback(async () => {
    setError("");
    const response = await fetch("/api/owner/overview");
    const result = (await response.json().catch(() => ({}))) as OwnerOverview & { message?: string };
    if (response.status === 401) {
      navigate(`/login?next=${encodeURIComponent("/dashboard")}`, { replace: true });
      return;
    }
    if (!response.ok) throw new Error(result.message ?? "اطلاعات داشبورد در دسترس نیست");
    setData(result);
  }, [navigate]);

  useEffect(() => { loadDashboard().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "اطلاعات داشبورد در دسترس نیست")).finally(() => setLoading(false)); }, [loadDashboard]);

  useEffect(() => {
    Promise.all([fetch("/api/owner/staff"), fetch("/api/owner/service-staff")])
      .then(async ([staffResponse, assignmentResponse]) => {
        const staffData = (await staffResponse.json().catch(() => ({}))) as { staff?: StaffMember[]; message?: string };
        const assignmentData = (await assignmentResponse.json().catch(() => ({}))) as { assignments?: Record<string, string[]>; message?: string };
        if (!staffResponse.ok) throw new Error(staffData.message ?? "پرسنل در دسترس نیستند");
        if (!assignmentResponse.ok) throw new Error(assignmentData.message ?? "ارتباط خدمات و پرسنل در دسترس نیست");
        setStaff(staffData.staff ?? []);
        setAssignments(assignmentData.assignments ?? {});
      })
      .catch((reason: unknown) => setAssignmentError(reason instanceof Error ? reason.message : "ارتباط خدمات و پرسنل در دسترس نیست"))
      .finally(() => setAssignmentLoading(false));
  }, []);

  const saveServiceStaff = async (serviceId: string) => {
    setAssignmentSaving(serviceId); setAssignmentError("");
    try {
      const response = await fetch(`/api/owner/services/${serviceId}/staff`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffIds: assignments[serviceId] ?? [] }) });
      const result = (await response.json().catch(() => ({}))) as { staffIds?: string[]; message?: string };
      if (!response.ok || !result.staffIds) throw new Error(result.message ?? "ذخیره پرسنل خدمت انجام نشد");
      setAssignments((current) => ({ ...current, [serviceId]: result.staffIds! }));
    } catch (reason: unknown) { setAssignmentError(reason instanceof Error ? reason.message : "ذخیره پرسنل خدمت انجام نشد"); }
    finally { setAssignmentSaving(""); }
  };

  const visibleBookings = useMemo(() => data?.bookings.filter((booking) => selectedTab === "all" || booking.status === selectedTab) ?? [], [data?.bookings, selectedTab]);
  const openServiceForm = (service?: Service) => { setEditingService(service ?? null); setServiceForm(service ? { title: service.title, durationMinutes: String(service.durationMinutes), price: String(service.price) } : { title: "", durationMinutes: "60", price: "" }); setServiceFormOpen(true); setActionError(""); };
  const saveService = async (event: FormEvent) => {
    event.preventDefault();
    setActionLoading(true); setActionError("");
    try {
      const endpoint = editingService ? `/api/owner/services/${editingService.id}` : "/api/owner/services";
      const response = await fetch(endpoint, { method: editingService ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: serviceForm.title, durationMinutes: Number(serviceForm.durationMinutes), price: Number(serviceForm.price) }) });
      const result = (await response.json().catch(() => ({}))) as { service?: Service; message?: string };
      if (!response.ok || !result.service) throw new Error(result.message ?? "ذخیره خدمت انجام نشد");
      setData((current) => current ? { ...current, services: editingService ? current.services.map((item) => item.id === editingService.id ? result.service! : item) : [result.service!, ...current.services] } : current);
      setServiceFormOpen(false);
    } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : "ذخیره خدمت انجام نشد"); }
    finally { setActionLoading(false); }
  };
  const deleteService = async (service: Service) => {
    if (!window.confirm(`خدمت «${service.title}» حذف شود؟`)) return;
    setActionLoading(true); setActionError("");
    try {
      const response = await fetch(`/api/owner/services/${service.id}`, { method: "DELETE" });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "حذف خدمت انجام نشد");
      setData((current) => current ? { ...current, services: current.services.filter((item) => item.id !== service.id) } : current);
    } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : "حذف خدمت انجام نشد"); }
    finally { setActionLoading(false); }
  };
  const toggleService = async (service: Service) => {
    setActionLoading(true); setActionError("");
    try {
      const response = await fetch(`/api/owner/services/${service.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !service.isActive }) });
      const result = (await response.json().catch(() => ({}))) as { service?: Service; message?: string };
      if (!response.ok || !result.service) throw new Error(result.message ?? "تغییر وضعیت خدمت انجام نشد");
      setData((current) => current ? { ...current, services: current.services.map((item) => item.id === service.id ? result.service! : item) } : current);
    } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : "تغییر وضعیت خدمت انجام نشد"); }
    finally { setActionLoading(false); }
  };
  const updateBookingStatus = async (booking: Booking, status: string) => {
    setActionLoading(true); setActionError("");
    try {
      const response = await fetch(`/api/owner/bookings/${booking.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "تغییر وضعیت رزرو انجام نشد");
      setData((current) => current ? { ...current, bookings: current.bookings.map((item) => item.id === booking.id ? { ...item, status } : item) } : current);
    } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : "تغییر وضعیت رزرو انجام نشد"); }
    finally { setActionLoading(false); }
  };
  const updateBookingStaff = async (booking: Booking, staffId: string) => {
    setBookingStaffSaving(booking.id); setActionError("");
    try {
      const response = await fetch(`/api/owner/bookings/${booking.id}/staff`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId: staffId || null }) });
      const result = (await response.json().catch(() => ({}))) as { booking?: { staffId: string | null }; message?: string };
      if (!response.ok || !result.booking) throw new Error(result.message ?? "تغییر پرسنل رزرو انجام نشد");
      const selectedMember = staff.find((member) => member.id === result.booking!.staffId);
      setData((current) => current ? { ...current, bookings: current.bookings.map((item) => item.id === booking.id ? { ...item, staffId: result.booking!.staffId, staffName: selectedMember?.name ?? null } : item) } : current);
    } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : "تغییر پرسنل رزرو انجام نشد"); }
    finally { setBookingStaffSaving(""); }
  };
  const toggleSalon = async () => {
    if (!data) return;
    setActionLoading(true); setActionError("");
    try {
      const response = await fetch("/api/owner/salon/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !data.salon.isActive }) });
      const result = (await response.json().catch(() => ({}))) as { salon?: { is_active: boolean }; message?: string };
      if (!response.ok || !result.salon) throw new Error(result.message ?? "تغییر وضعیت پذیرش انجام نشد");
      setData((current) => current ? { ...current, salon: { ...current.salon, isActive: result.salon!.is_active } } : current);
    } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : "تغییر وضعیت پذیرش انجام نشد"); }
    finally { setActionLoading(false); }
  };
  const openSalonForm = () => { if (!data) return; setSalonForm({ name: data.salon.name, city: data.salon.city, area: data.salon.area, category: data.salon.category, startingPrice: String(data.salon.startingPrice), image: data.salon.image, description: data.salon.description, address: data.salon.address, phone: data.salon.phone ?? "", instagram: data.salon.instagram ?? "", galleryImages: data.salon.galleryImages.join("\n") }); setEditingSalon(true); setActionError(""); };
  const saveSalon = async (event: FormEvent) => {
    event.preventDefault(); setActionLoading(true); setActionError("");
    try {
      const response = await fetch("/api/owner/salon", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...salonForm, startingPrice: Number(salonForm.startingPrice), phone: salonForm.phone || null, instagram: salonForm.instagram || null, galleryImages: salonForm.galleryImages.split("\n").map((value) => value.trim()).filter(Boolean) }) });
      const result = (await response.json().catch(() => ({}))) as { salon?: { id: string; name: string; city: string; area: string; category: string; starting_price: number; image: string; description: string; address: string; phone: string | null; instagram: string | null; gallery_images: string[]; is_active: boolean; approval_status: string }; message?: string };
      if (!response.ok || !result.salon) throw new Error(result.message ?? "ویرایش اطلاعات سالن انجام نشد");
      setData((current) => current ? { ...current, salon: { ...current.salon, name: result.salon!.name, city: result.salon!.city, area: result.salon!.area, category: result.salon!.category, startingPrice: result.salon!.starting_price, image: result.salon!.image, description: result.salon!.description, address: result.salon!.address, phone: result.salon!.phone, instagram: result.salon!.instagram, galleryImages: result.salon!.gallery_images, isActive: result.salon!.is_active, approvalStatus: result.salon!.approval_status } } : current);
      setEditingSalon(false);
    } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : "ویرایش اطلاعات سالن انجام نشد"); }
    finally { setActionLoading(false); }
  };

  if (loading) return <div className="container flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">در حال دریافت داشبورد سالن...</div>;
  if (error || !data) return <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center"><ShieldCheck className="h-12 w-12 text-primary" /><h1 className="text-xl font-extrabold text-foreground">اطلاعات داشبورد سالن در دسترس نیست</h1><p className="max-w-md text-sm leading-7 text-muted-foreground">{error || "سالن متصل به این حساب پیدا نشد."}</p><Button variant="outline" onClick={() => { setLoading(true); loadDashboard().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "خطا در دریافت اطلاعات")).finally(() => setLoading(false)); }}>تلاش دوباره</Button></div>;

  const { salon, stats } = data;
  const statCards = [{ title: "رزروهای امروز", value: stats.todayBookings, detail: `${stats.pendingBookings} رزرو در انتظار`, icon: CalendarDays, tone: "bg-primary/10 text-primary" }, { title: "درآمد این ماه", value: `${formatPrice(stats.monthRevenue)} تومان`, detail: "از رزروهای تاییدشده", icon: DollarSign, tone: "bg-emerald-100 text-emerald-600" }, { title: "مشتریان", value: stats.customers, detail: "مشتری یکتا", icon: Users, tone: "bg-blue-100 text-blue-600" }, { title: "امتیاز سالن", value: salon.rating, detail: `از ۵ · ${salon.reviewCount} نظر`, icon: Star, tone: "bg-gold-100 text-gold-700" }];
  return <div className="bg-secondary/30 py-8"><div className="container">
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-muted-foreground">{salon.city}، {salon.area}</p><h1 className="mt-1 text-2xl font-extrabold text-foreground md:text-3xl">صبح بخیر، {salon.name}</h1><p className="mt-2 text-sm text-muted-foreground">مدیریت رزروها و خدمات سالن از اینجا انجام می‌شود.</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="اعلان‌ها"><Bell className="h-4 w-4" /></Button><Button onClick={() => openServiceForm()} className="gap-2"><Plus className="h-4 w-4" />افزودن خدمت</Button></div></div>
    {salon.approvalStatus !== "approved" && <div className="mb-5 rounded-xl bg-gold-100 px-4 py-3 text-sm text-gold-800">پروفایل سالن شما در وضعیت «{salon.approvalStatus === "pending" ? "در انتظار تأیید" : "رد شده"}» است و تا تأیید نهایی در جستجوی عمومی نمایش داده نمی‌شود.</div>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{statCards.map((stat) => <div key={stat.title} className="rounded-2xl border border-border bg-card p-5"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}><stat.icon className="h-5 w-5" /></span><p className="mt-4 text-sm text-muted-foreground">{stat.title}</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{typeof stat.value === "number" ? new Intl.NumberFormat("fa-IR").format(stat.value) : stat.value}</p><p className="mt-2 text-xs text-muted-foreground">{stat.detail}</p></div>)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-foreground">رزروهای سالن</h2><p className="mt-1 text-xs text-muted-foreground">مدیریت نوبت‌های دریافت‌شده</p></div><Link to="/dashboard/schedule" className="text-sm font-semibold text-primary">زمان‌بندی <Settings2 className="mr-1 inline h-4 w-4" /></Link></div><div className="mt-5 flex gap-2 border-b border-border pb-3">{[["all", "همه"], ["pending", "در انتظار"], ["confirmed", "تایید شده"], ["completed", "تکمیل شده"], ["cancelled", "لغوشده"], ["no_show", "عدم مراجعه"]].map(([value, label]) => <button key={value} onClick={() => setSelectedTab(value)} className={`rounded-full px-4 py-2 text-xs font-semibold ${selectedTab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>{label}</button>)}</div><div className="divide-y divide-border">{visibleBookings.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">رزروی در این بخش وجود ندارد.</p> : visibleBookings.slice(0, 8).map((booking) => { const status = statusLabels[booking.status] ?? statusLabels.pending; return <div key={booking.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-foreground">{booking.customerPhone}</p>{booking.staffName && <p className="mt-1 text-xs text-muted-foreground">پرسنل: {booking.staffName}</p>}<p className="mt-1 truncate text-xs text-muted-foreground">{booking.serviceTitle}</p></div><div className="text-xs text-muted-foreground"><p className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatDate(booking.appointmentDate)}، {booking.appointmentTime}</p><p className="mt-1 font-bold text-foreground">{formatPrice(booking.price)} تومان</p></div><select value={booking.status} disabled={actionLoading} onChange={(event) => void updateBookingStatus(booking, event.target.value)} className={`h-8 rounded-md border-0 px-2 text-[11px] font-semibold ${status.className}`}><option value="pending">در انتظار</option><option value="confirmed">تایید شده</option><option value="completed">تکمیل شده</option><option value="cancelled">لغو شده</option><option value="no_show">عدم مراجعه</option></select>{staff.length > 0 && <select value={booking.staffId ?? ""} disabled={bookingStaffSaving === booking.id} onChange={(event) => void updateBookingStaff(booking, event.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-[11px] font-semibold text-foreground" aria-label={`پرسنل رزرو ${booking.customerPhone}`}><option value="">بدون پرسنل</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>}</div>; })}</div></section>
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-extrabold text-foreground">وضعیت پذیرش</h2><p className="mt-1 text-xs text-muted-foreground">نمایش سالن به کاربران</p></div><button onClick={() => void toggleSalon()} disabled={actionLoading} className={`relative h-7 w-12 rounded-full transition-colors ${salon.isActive ? "bg-primary" : "bg-muted"}`} aria-label="تغییر وضعیت پذیرش"><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${salon.isActive ? "right-1" : "right-6"}`} /></button></div><div className={`mt-5 rounded-2xl p-4 ${salon.isActive ? "bg-emerald-50" : "bg-secondary"}`}><p className={`text-sm font-bold ${salon.isActive ? "text-emerald-700" : "text-muted-foreground"}`}>{salon.isActive ? "سالن شما فعال است" : "پذیرش موقتاً بسته است"}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{salon.isActive ? "کاربران می‌توانند زمان‌های خالی را ببینند و نوبت رزرو کنند." : "سالن در جستجوهای عمومی نمایش داده نمی‌شود."}</p></div><Button variant="outline" className="mt-5 w-full gap-2" onClick={openSalonForm}><Pencil className="h-4 w-4" />ویرایش اطلاعات سالن</Button></section></div>
    {editingSalon && <form onSubmit={saveSalon} className="mt-6 rounded-2xl border border-primary/20 bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-foreground">ویرایش اطلاعات سالن</h2><p className="mt-1 text-xs text-muted-foreground">تغییرات بعد از بررسی در پروفایل عمومی نمایش داده می‌شوند.</p></div><Button type="button" variant="ghost" onClick={() => setEditingSalon(false)}>انصراف</Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Input value={salonForm.name} onChange={(event) => setSalonForm({ ...salonForm, name: event.target.value })} placeholder="نام سالن" required /><Input value={salonForm.city} onChange={(event) => setSalonForm({ ...salonForm, city: event.target.value })} placeholder="شهر" required /><Input value={salonForm.area} onChange={(event) => setSalonForm({ ...salonForm, area: event.target.value })} placeholder="منطقه" required /><Input value={salonForm.category} onChange={(event) => setSalonForm({ ...salonForm, category: event.target.value })} placeholder="دسته‌بندی" required /><Input type="number" min="0" value={salonForm.startingPrice} onChange={(event) => setSalonForm({ ...salonForm, startingPrice: event.target.value })} placeholder="قیمت شروع" required /></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Input type="url" value={salonForm.image} onChange={(event) => setSalonForm({ ...salonForm, image: event.target.value })} placeholder="URL تصویر اصلی سالن" required /><Input value={salonForm.address} onChange={(event) => setSalonForm({ ...salonForm, address: event.target.value })} placeholder="آدرس کامل سالن" /><Input value={salonForm.phone} onChange={(event) => setSalonForm({ ...salonForm, phone: event.target.value })} placeholder="شماره تماس سالن" inputMode="tel" /><Input value={salonForm.instagram} onChange={(event) => setSalonForm({ ...salonForm, instagram: event.target.value })} placeholder="لینک اینستاگرام" /></div><textarea value={salonForm.description} onChange={(event) => setSalonForm({ ...salonForm, description: event.target.value })} placeholder="توضیحات کامل سالن" maxLength={2000} className="mt-3 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary" /><textarea value={salonForm.galleryImages} onChange={(event) => setSalonForm({ ...salonForm, galleryImages: event.target.value })} placeholder="URL تصاویر گالری؛ هر URL در یک خط" className="mt-3 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary" /><Button type="submit" disabled={actionLoading} className="mt-4">ذخیره اطلاعات</Button></form>}
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-foreground">خدمات سالن</h2><p className="mt-1 text-xs text-muted-foreground">مدیریت خدمات و قیمت‌ها</p></div><Button variant="outline" size="sm" onClick={() => openServiceForm()} className="gap-2"><Plus className="h-4 w-4" />افزودن خدمت</Button></div><div className="mt-5 grid gap-3 md:grid-cols-3">{data.services.map((service) => <div key={service.id} className="rounded-xl border border-border p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Scissors className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-foreground">{service.title}</p><p className="mt-1 text-xs text-muted-foreground">{service.durationMinutes} دقیقه · {formatPrice(service.price)} تومان</p></div></div><div className="mt-4 border-t border-border pt-3"><p className="text-xs font-semibold text-foreground">پرسنل ارائه‌دهنده</p>{assignmentLoading ? <p className="mt-2 text-xs text-muted-foreground">در حال دریافت...</p> : staff.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">ابتدا پرسنل سالن را اضافه کنید.</p> : <div className="mt-2 space-y-2">{staff.map((member) => { const selected = (assignments[service.id] ?? []).includes(member.id); return <label key={member.id} className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={selected} onChange={() => setAssignments((current) => ({ ...current, [service.id]: selected ? (current[service.id] ?? []).filter((id) => id !== member.id) : [...(current[service.id] ?? []), member.id] }))} className="accent-primary" />{member.name}<span className="text-[10px]">({member.roleTitle})</span></label>; })}</div>}<Button size="sm" variant="outline" disabled={assignmentLoading || assignmentSaving === service.id || staff.length === 0} onClick={() => void saveServiceStaff(service.id)} className="mt-3 w-full">{assignmentSaving === service.id ? "در حال ذخیره..." : "ذخیره پرسنل خدمت"}</Button></div><div className="mt-4 flex gap-2 border-t border-border pt-3"><Button size="sm" variant="outline" onClick={() => openServiceForm(service)} className="flex-1 gap-1"><Pencil className="h-3.5 w-3.5" />ویرایش</Button><Button size="sm" variant="ghost" disabled={actionLoading} onClick={() => void toggleService(service)}>{service.isActive ? "غیرفعال" : "فعال"}</Button><Button size="sm" variant="ghost" disabled={actionLoading} onClick={() => void deleteService(service)} className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" />حذف</Button></div></div>)}{data.services.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">هنوز خدمتی ثبت نشده است.</p>}</div>{serviceFormOpen && <form onSubmit={saveService} className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-extrabold text-foreground">{editingService ? "ویرایش خدمت" : "افزودن خدمت جدید"}</h3><Button type="button" variant="ghost" size="sm" onClick={() => setServiceFormOpen(false)}>انصراف</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Input value={serviceForm.title} onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })} placeholder="نام خدمت" required /><Input type="number" min="5" max="720" value={serviceForm.durationMinutes} onChange={(event) => setServiceForm({ ...serviceForm, durationMinutes: event.target.value })} placeholder="مدت به دقیقه" required /><Input type="number" min="0" value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} placeholder="قیمت به تومان" required /></div><Button type="submit" disabled={actionLoading} className="mt-4">{actionLoading ? "در حال ذخیره..." : "ذخیره خدمت"}</Button></form>}</section>
    {actionError && <div className="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"><XCircle className="h-4 w-4" />{actionError}</div>}
    {assignmentError && <div className="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"><XCircle className="h-4 w-4" />{assignmentError}</div>}
  </div></div>;
}
