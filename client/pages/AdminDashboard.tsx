import { FormEvent, useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarDays, ChevronLeft, Clock3, LayoutDashboard, MapPin, Pencil, Scissors, ShieldCheck, Star, Store, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";

interface Overview {
  stats: { users: { total: number; customers: number; salonOwners: number }; salons: { total: number }; bookings: { total: number; active: number; revenue: number } };
  recentBookings: AdminBooking[];
  topSalons: AdminSalon[];
}
interface AdminUser { id: string; phone: string; role: string; salonName: string | null; isActive: boolean; createdAt: string; }
interface AdminSalon { id: string; name: string; city: string; area?: string; category: string; rating: number; reviewCount: number; startingPrice?: number; isActive?: boolean; approvalStatus?: string; serviceCount?: number; bookingCount: number; }
interface AdminBooking { id: string; salonName: string; customerPhone: string; serviceTitle: string; price: number; appointmentDate: string; appointmentTime: string; status: string; createdAt: string; }
type Section = "overview" | "users" | "salons" | "bookings";

const statusLabels: Record<string, { label: string; className: string }> = {
  confirmed: { label: "تایید شده", className: "bg-emerald-100 text-emerald-700" },
  pending: { label: "در انتظار", className: "bg-gold-100 text-gold-800" },
  cancelled: { label: "لغو شده", className: "bg-secondary text-muted-foreground" },
  completed: { label: "تکمیل شده", className: "bg-blue-100 text-blue-700" },
  no_show: { label: "عدم مراجعه", className: "bg-red-100 text-red-700" },
};
const approvalLabels: Record<string, string> = { pending: "در انتظار بررسی", approved: "تایید شده", rejected: "رد شده" };

function formatPrice(value: number) { return new Intl.NumberFormat("fa-IR").format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`)); }
function roleLabel(role: string) { return role === "admin" ? "مدیر" : role === "salon" ? "صاحب سالن" : "مشتری"; }

export default function AdminDashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [salons, setSalons] = useState<AdminSalon[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [section, setSection] = useState<Section>("overview");
  const [query, setQuery] = useState("");
  const [bookingFilter, setBookingFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [error, setError] = useState("");
  const [collectionError, setCollectionError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingSalon, setEditingSalon] = useState<AdminSalon | null>(null);
  const [salonForm, setSalonForm] = useState({ name: "", city: "", area: "", category: "", startingPrice: "" });

  const loadOverview = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/overview");
    const data = (await response.json().catch(() => ({}))) as Overview & { message?: string };
    if (!response.ok) throw new Error(data.message ?? "اطلاعات مدیریت در دسترس نیست");
    setOverview(data);
  }, []);

  const loadCollection = useCallback(async (target: Exclude<Section, "overview">, search = "", status = "all") => {
    setCollectionLoading(true);
    setCollectionError("");
    try {
      const endpoint = target === "users" ? "/api/admin/users" : target === "salons" ? "/api/admin/salons" : "/api/admin/bookings";
      const params = new URLSearchParams();
      if (search && target !== "bookings") params.set("q", search);
      if (target === "bookings" && status !== "all") params.set("status", status);
      const response = await fetch(`${endpoint}${params.size ? `?${params.toString()}` : ""}`);
      const data = (await response.json().catch(() => ({}))) as { users?: AdminUser[]; salons?: AdminSalon[]; bookings?: AdminBooking[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? "اطلاعات این بخش در دسترس نیست");
      if (target === "users") setUsers(data.users ?? []);
      if (target === "salons") setSalons(data.salons ?? []);
      if (target === "bookings") setBookings(data.bookings ?? []);
    } catch (reason: unknown) {
      setCollectionError(reason instanceof Error ? reason.message : "اطلاعات این بخش در دسترس نیست");
    } finally {
      setCollectionLoading(false);
    }
  }, []);

  useEffect(() => { loadOverview().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "اطلاعات مدیریت در دسترس نیست")).finally(() => setLoading(false)); }, [loadOverview]);
  useEffect(() => { if (section !== "overview") void loadCollection(section, "", bookingFilter); }, [bookingFilter, loadCollection, section]);

  const refresh = async () => {
    setLoading(true);
    try { await loadOverview(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "اطلاعات مدیریت در دسترس نیست"); } finally { setLoading(false); }
  };
  const changeSection = (next: Section) => { setSection(next); setQuery(""); setCollectionError(""); setEditingSalon(null); };
  const searchCollection = (event: FormEvent) => { event.preventDefault(); if (section !== "overview") void loadCollection(section, query, bookingFilter); };

  const updateUserStatus = async (item: AdminUser) => {
    setUpdatingId(item.id); setCollectionError("");
    try {
      const response = await fetch(`/api/admin/users/${item.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }) });
      const data = (await response.json().catch(() => ({}))) as { user?: { is_active: boolean }; message?: string };
      if (!response.ok || !data.user) throw new Error(data.message ?? "تغییر وضعیت کاربر انجام نشد");
      setUsers((current) => current.map((userItem) => userItem.id === item.id ? { ...userItem, isActive: data.user!.is_active } : userItem));
    } catch (reason: unknown) { setCollectionError(reason instanceof Error ? reason.message : "تغییر وضعیت کاربر انجام نشد"); }
    finally { setUpdatingId(null); }
  };

  const updateSalonStatus = async (item: AdminSalon, approvalStatus: string, isActive = item.isActive ?? true) => {
    setUpdatingId(item.id); setCollectionError("");
    try {
      const response = await fetch(`/api/admin/salons/${item.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvalStatus, isActive }) });
      const data = (await response.json().catch(() => ({}))) as { salon?: { is_active: boolean; approval_status: string }; message?: string };
      if (!response.ok || !data.salon) throw new Error(data.message ?? "تغییر وضعیت سالن انجام نشد");
      setSalons((current) => current.map((salon) => salon.id === item.id ? { ...salon, isActive: data.salon!.is_active, approvalStatus: data.salon!.approval_status } : salon));
    } catch (reason: unknown) { setCollectionError(reason instanceof Error ? reason.message : "تغییر وضعیت سالن انجام نشد"); }
    finally { setUpdatingId(null); }
  };

  const openSalonEditor = (salon: AdminSalon) => {
    setEditingSalon(salon);
    setSalonForm({ name: salon.name, city: salon.city, area: salon.area ?? "", category: salon.category, startingPrice: String(salon.startingPrice ?? "") });
  };
  const saveSalon = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingSalon) return;
    setUpdatingId(editingSalon.id); setCollectionError("");
    try {
      const response = await fetch(`/api/admin/salons/${editingSalon.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...salonForm, startingPrice: Number(salonForm.startingPrice) }) });
      const data = (await response.json().catch(() => ({}))) as { salon?: { id: string; name: string; city: string; area: string; category: string; starting_price: number; is_active: boolean; approval_status: string }; message?: string };
      if (!response.ok || !data.salon) throw new Error(data.message ?? "ویرایش سالن انجام نشد");
      setSalons((current) => current.map((salon) => salon.id === editingSalon.id ? { ...salon, name: data.salon!.name, city: data.salon!.city, area: data.salon!.area, category: data.salon!.category, startingPrice: data.salon!.starting_price, isActive: data.salon!.is_active, approvalStatus: data.salon!.approval_status } : salon));
      setEditingSalon(null);
    } catch (reason: unknown) { setCollectionError(reason instanceof Error ? reason.message : "ویرایش سالن انجام نشد"); }
    finally { setUpdatingId(null); }
  };

  const updateBookingStatus = async (id: string, status: string) => {
    setUpdatingId(id); setCollectionError("");
    try {
      const response = await fetch(`/api/admin/bookings/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "تغییر وضعیت انجام نشد");
      setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status } : booking));
      setOverview((current) => current ? { ...current, recentBookings: current.recentBookings.map((booking) => booking.id === id ? { ...booking, status } : booking) } : current);
    } catch (reason: unknown) { setCollectionError(reason instanceof Error ? reason.message : "تغییر وضعیت انجام نشد"); }
    finally { setUpdatingId(null); }
  };

  if (loading) return <div className="container flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">در حال دریافت داشبورد مدیریت...</div>;
  if (error || !overview) return <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center"><ShieldCheck className="h-12 w-12 text-primary" /><h1 className="text-xl font-extrabold text-foreground">دسترسی یا اطلاعات مدیریت در دسترس نیست</h1><p className="max-w-md text-sm leading-7 text-muted-foreground">{error || "اطلاعاتی برای نمایش وجود ندارد."}</p><Button variant="outline" onClick={refresh}>تلاش دوباره</Button></div>;

  const { stats } = overview;
  const statCards = [
    { title: "کل کاربران", value: stats.users.total, detail: `${stats.users.customers} مشتری · ${stats.users.salonOwners} صاحب سالن`, icon: Users, tone: "bg-primary/10 text-primary" },
    { title: "سالن‌های ثبت‌شده", value: stats.salons.total, detail: "سالن فعال در مارکت‌پلیس", icon: Store, tone: "bg-blue-100 text-blue-700" },
    { title: "کل رزروها", value: stats.bookings.total, detail: `${stats.bookings.active} رزرو تاییدشده`, icon: CalendarDays, tone: "bg-gold-100 text-gold-700" },
    { title: "درآمد ثبت‌شده", value: `${formatPrice(stats.bookings.revenue)} تومان`, detail: "از رزروهای تاییدشده", icon: BarChart3, tone: "bg-emerald-100 text-emerald-700" },
  ];
  const navItems: Array<[Section, string, typeof LayoutDashboard]> = [["overview", "نمای کلی", LayoutDashboard], ["users", "کاربران", Users], ["salons", "سالن‌ها", Store], ["bookings", "رزروها", CalendarDays]];

  return <div className="bg-secondary/30 py-8"><div className="container">
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">مدیریت مرکزی نوبتو</p><h1 className="mt-1 text-2xl font-extrabold text-foreground md:text-3xl">داشبورد مدیریت</h1><p className="mt-2 text-sm text-muted-foreground">سلام {user?.phone}، اینجا مرکز کنترل مارکت‌پلیس است.</p></div><div className="flex items-center gap-2"><span className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />سیستم فعال</span><Button variant="outline" size="sm" onClick={refresh}>به‌روزرسانی</Button></div></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{statCards.map((stat) => <div key={stat.title} className="rounded-2xl border border-border bg-card p-5"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}><stat.icon className="h-5 w-5" /></span><p className="mt-4 text-sm text-muted-foreground">{stat.title}</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{typeof stat.value === "number" ? new Intl.NumberFormat("fa-IR").format(stat.value) : stat.value}</p><p className="mt-2 text-xs text-muted-foreground">{stat.detail}</p></div>)}</div>
    <div className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2">{navItems.map(([value, label, Icon]) => <button key={value} onClick={() => changeSection(value)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${section === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>

    {section === "overview" ? <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-foreground">آخرین رزروها</h2><p className="mt-1 text-xs text-muted-foreground">آخرین فعالیت‌های ثبت‌شده در سامانه</p></div><CalendarDays className="h-5 w-5 text-primary" /></div><div className="mt-5 divide-y divide-border">{overview.recentBookings.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">هنوز رزروی ثبت نشده است.</p> : overview.recentBookings.map((booking) => { const status = statusLabels[booking.status] ?? { label: booking.status, className: "bg-secondary text-muted-foreground" }; return <div key={booking.id} className="flex items-center gap-3 py-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Scissors className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-foreground">{booking.salonName}</p><p className="mt-1 truncate text-xs text-muted-foreground">{booking.serviceTitle} · {booking.customerPhone}</p></div><div className="hidden text-left text-xs text-muted-foreground sm:block"><p className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatDate(booking.appointmentDate)}، {booking.appointmentTime}</p><p className="mt-1 font-bold text-foreground">{formatPrice(booking.price)} تومان</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span></div>; })}</div></section><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-foreground">سالن‌های برتر</h2><p className="mt-1 text-xs text-muted-foreground">بر اساس تعداد رزرو</p></div><Star className="h-5 w-5 fill-gold-500 text-gold-500" /></div><div className="mt-5 space-y-3">{overview.topSalons.map((salon, index) => <Link key={salon.id} to={`/salons/${salon.id}`} className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-extrabold text-primary">{new Intl.NumberFormat("fa-IR").format(index + 1)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-foreground">{salon.name}</p><p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{salon.city} · {salon.bookingCount} رزرو</p></div><span className="flex items-center gap-1 text-xs font-bold text-gold-700"><Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />{salon.rating}</span><ChevronLeft className="h-4 w-4 text-muted-foreground" /></Link>)}</div></section></div> : <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-extrabold text-foreground">{section === "users" ? "مدیریت کاربران" : section === "salons" ? "مدیریت سالن‌ها" : "مدیریت رزروها"}</h2><p className="mt-1 text-xs text-muted-foreground">اطلاعات این بخش از PostgreSQL خوانده می‌شود.</p></div><form onSubmit={searchCollection} className="flex gap-2">{section === "bookings" ? <select value={bookingFilter} onChange={(event) => setBookingFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">همه وضعیت‌ها</option><option value="pending">در انتظار</option><option value="confirmed">تایید شده</option><option value="completed">تکمیل شده</option><option value="cancelled">لغو شده</option></select> : <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={section === "users" ? "جستجوی شماره یا نام سالن" : "جستجوی نام، شهر یا دسته"} className="w-56" />}<Button type="submit" variant="outline">جستجو</Button></form></div>{collectionError && <p className="mt-5 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{collectionError}</p>}{collectionLoading ? <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">در حال دریافت اطلاعات...</div> : section === "users" ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-right text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-3 py-3 font-medium">شماره موبایل</th><th className="px-3 py-3 font-medium">نوع حساب</th><th className="px-3 py-3 font-medium">نام سالن</th><th className="px-3 py-3 font-medium">وضعیت</th><th className="px-3 py-3 font-medium">عملیات</th></tr></thead><tbody>{users.map((item) => <tr key={item.id} className="border-b border-border/70"><td className="px-3 py-4 font-medium" dir="ltr">{item.phone}</td><td className="px-3 py-4"><span className="rounded-full bg-secondary px-2.5 py-1 text-xs">{roleLabel(item.role)}</span></td><td className="px-3 py-4 text-muted-foreground">{item.salonName || "—"}</td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{item.isActive ? "فعال" : "غیرفعال"}</span></td><td className="px-3 py-4"><Button size="sm" variant="outline" disabled={updatingId === item.id || item.role === "admin"} onClick={() => void updateUserStatus(item)}>{item.isActive ? "غیرفعال‌کردن" : "فعال‌کردن"}</Button></td></tr>)}</tbody></table>{users.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">کاربری پیدا نشد.</p>}</div> : section === "salons" ? <div className="mt-5 grid gap-3 md:grid-cols-2">{salons.map((salon) => <div key={salon.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-foreground">{salon.name}</h3><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{salon.city}، {salon.area}</p></div><span className="flex items-center gap-1 text-xs font-bold text-gold-700"><Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />{salon.rating}</span></div><p className="mt-3 text-xs text-muted-foreground">{salon.category}</p><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><label className="text-muted-foreground">تأیید سالن<select value={salon.approvalStatus ?? "approved"} disabled={updatingId === salon.id} onChange={(event) => void updateSalonStatus(salon, event.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-foreground"><option value="pending">در انتظار بررسی</option><option value="approved">تایید شده</option><option value="rejected">رد شده</option></select></label><div className="text-muted-foreground">نمایش در سایت<button disabled={updatingId === salon.id} onClick={() => void updateSalonStatus(salon, salon.approvalStatus ?? "approved", !(salon.isActive ?? true))} className={`mt-1 flex h-9 w-full items-center justify-center rounded-md border text-xs font-semibold ${salon.isActive ?? true ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-secondary text-muted-foreground"}`}>{salon.isActive ?? true ? "فعال" : "غیرفعال"}</button></div></div><div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs"><span>{salon.serviceCount} خدمت · {salon.bookingCount} رزرو · {approvalLabels[salon.approvalStatus ?? "approved"]}</span><Button size="sm" variant="outline" onClick={() => openSalonEditor(salon)} className="gap-1"><Pencil className="h-3.5 w-3.5" />ویرایش</Button></div></div>)}{salons.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">سالنی پیدا نشد.</p>}{editingSalon && <form onSubmit={saveSalon} className="md:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-center justify-between"><div><h3 className="text-sm font-extrabold text-foreground">ویرایش {editingSalon.name}</h3><p className="mt-1 text-xs text-muted-foreground">اطلاعات اصلی سالن را اصلاح کنید.</p></div><Button type="button" variant="ghost" size="sm" onClick={() => setEditingSalon(null)}>انصراف</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Input aria-label="نام سالن" value={salonForm.name} onChange={(event) => setSalonForm({ ...salonForm, name: event.target.value })} placeholder="نام سالن" required /><Input aria-label="شهر" value={salonForm.city} onChange={(event) => setSalonForm({ ...salonForm, city: event.target.value })} placeholder="شهر" required /><Input aria-label="منطقه" value={salonForm.area} onChange={(event) => setSalonForm({ ...salonForm, area: event.target.value })} placeholder="منطقه" required /><Input aria-label="دسته‌بندی" value={salonForm.category} onChange={(event) => setSalonForm({ ...salonForm, category: event.target.value })} placeholder="دسته‌بندی" required /><Input aria-label="قیمت شروع" type="number" min="0" value={salonForm.startingPrice} onChange={(event) => setSalonForm({ ...salonForm, startingPrice: event.target.value })} placeholder="قیمت شروع" required /></div><Button type="submit" disabled={updatingId === editingSalon.id} className="mt-4">{updatingId === editingSalon.id ? "در حال ذخیره..." : "ذخیره تغییرات"}</Button></form>}</div> : <div className="mt-5 space-y-3">{bookings.map((booking) => { const status = statusLabels[booking.status] ?? statusLabels.pending; return <div key={booking.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">{booking.salonName} · {booking.serviceTitle}</p><p className="mt-1 text-xs text-muted-foreground">{booking.customerPhone} · {formatDate(booking.appointmentDate)}، {booking.appointmentTime}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span><span className="text-sm font-bold text-foreground">{formatPrice(booking.price)} تومان</span><select value={booking.status} disabled={updatingId === booking.id} onChange={(event) => void updateBookingStatus(booking.id, event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs"><option value="pending">در انتظار</option><option value="confirmed">تایید شده</option><option value="completed">تکمیل شده</option><option value="cancelled">لغو شده</option><option value="no_show">عدم مراجعه</option></select></div>; })}{bookings.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">رزروی پیدا نشد.</p>}</div>}</section>}
  </div></div>;
}
