import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowRight, ImagePlus, Pencil, Plus, Scissors, Trash2, UserRound, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StaffMember { id: string; name: string; roleTitle: string; phone: string | null; image: string | null; isActive: boolean; }
type StaffForm = { name: string; roleTitle: string; phone: string; image: string };
const emptyForm: StaffForm = { name: "", roleTitle: "", phone: "", image: "" };

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const loadStaff = useCallback(async () => {
    setError("");
    const response = await fetch("/api/owner/staff");
    const data = (await response.json().catch(() => ({}))) as { staff?: StaffMember[]; message?: string };
    if (!response.ok) throw new Error(data.message ?? "پرسنل در دسترس نیستند");
    setStaff(data.staff ?? []);
  }, []);

  useEffect(() => { loadStaff().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "پرسنل در دسترس نیستند")).finally(() => setLoading(false)); }, [loadStaff]);

  const openForm = (member?: StaffMember) => {
    setFormOpen(true);
    setEditing(member ?? null);
    setForm(member ? { name: member.name, roleTitle: member.roleTitle, phone: member.phone ?? "", image: member.image ?? "" } : emptyForm);
    setFormError("");
  };

  const saveStaff = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      const response = await fetch(editing ? `/api/owner/staff/${editing.id}` : "/api/owner/staff", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, roleTitle: form.roleTitle, phone: form.phone || null, image: form.image || null, ...(editing ? { isActive: editing.isActive } : {}) }) });
      const data = (await response.json().catch(() => ({}))) as { staff?: StaffMember; message?: string };
      if (!response.ok || !data.staff) throw new Error(data.message ?? "ذخیره پرسنل انجام نشد");
      setStaff((current) => editing ? current.map((item) => item.id === editing.id ? data.staff! : item) : [data.staff!, ...current]);
      setFormOpen(false); setEditing(null); setForm(emptyForm);
    } catch (reason: unknown) { setFormError(reason instanceof Error ? reason.message : "ذخیره پرسنل انجام نشد"); }
    finally { setSaving(false); }
  };

  const toggleStaff = async (member: StaffMember) => {
    setError("");
    const response = await fetch(`/api/owner/staff/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !member.isActive }) });
    const data = (await response.json().catch(() => ({}))) as { staff?: StaffMember; message?: string };
    if (!response.ok || !data.staff) { setError(data.message ?? "تغییر وضعیت پرسنل انجام نشد"); return; }
    setStaff((current) => current.map((item) => item.id === member.id ? data.staff! : item));
  };

  const deleteStaff = async (member: StaffMember) => {
    if (!window.confirm(`پرسنل «${member.name}» حذف شود؟`)) return;
    const response = await fetch(`/api/owner/staff/${member.id}`, { method: "DELETE" });
    if (!response.ok) { const data = (await response.json().catch(() => ({}))) as { message?: string }; setError(data.message ?? "حذف پرسنل انجام نشد"); return; }
    setStaff((current) => current.filter((item) => item.id !== member.id));
  };

  if (loading) return <div className="container flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">در حال دریافت پرسنل سالن...</div>;

  return <div className="bg-secondary/30 py-8"><div className="container"><Link to="/dashboard" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowRight className="h-4 w-4" />بازگشت به داشبورد</Link><div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">مدیریت تیم سالن</p><h1 className="mt-1 text-2xl font-extrabold text-foreground md:text-3xl">پرسنل سالن</h1><p className="mt-2 text-sm text-muted-foreground">اعضای تیم و وضعیت فعالیت آن‌ها را مدیریت کنید.</p></div><Button onClick={() => openForm()} className="gap-2"><Plus className="h-4 w-4" />افزودن پرسنل</Button></div>{error && <div className="mb-5 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"><XCircle className="h-4 w-4" />{error}</div>}{formOpen ? <form onSubmit={saveStaff} className="mb-6 rounded-2xl border border-primary/20 bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-foreground">{editing ? "ویرایش پرسنل" : "افزودن پرسنل جدید"}</h2><p className="mt-1 text-xs text-muted-foreground">اطلاعاتی که مشتری در زمان رزرو مشاهده می‌کند.</p></div><Button type="button" variant="ghost" onClick={() => { setFormOpen(false); setEditing(null); setForm(emptyForm); }}>انصراف</Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="نام و نام خانوادگی" required /><Input value={form.roleTitle} onChange={(event) => setForm({ ...form, roleTitle: event.target.value })} placeholder="تخصص یا عنوان شغلی" required /><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="شماره موبایل (اختیاری)" dir="ltr" /><Input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="لینک تصویر (اختیاری)" dir="ltr" /></div>{formError && <p className="mt-3 text-sm text-destructive">{formError}</p>}<Button type="submit" disabled={saving} className="mt-5">{saving ? "در حال ذخیره..." : "ذخیره پرسنل"}</Button></form> : null}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{staff.map((member) => <article key={member.id} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-start gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">{member.image ? <img src={member.image} alt={member.name} className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6" />}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate text-base font-extrabold text-foreground">{member.name}</h2><span className={`h-2 w-2 shrink-0 rounded-full ${member.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} /></div><p className="mt-1 text-sm text-primary">{member.roleTitle}</p>{member.phone && <p className="mt-2 text-xs text-muted-foreground" dir="ltr">{member.phone}</p>}</div></div><div className="mt-5 flex gap-2 border-t border-border pt-3"><Button asChild size="sm" variant="outline" className="flex-1 gap-1"><Link to={`/dashboard/staff/${member.id}/schedule`}>تقویم</Link></Button><Button size="sm" variant="outline" onClick={() => openForm(member)} className="flex-1 gap-1"><Pencil className="h-3.5 w-3.5" />ویرایش</Button><Button size="sm" variant="ghost" onClick={() => void toggleStaff(member)}>{member.isActive ? "غیرفعال" : "فعال"}</Button><Button size="sm" variant="ghost" onClick={() => void deleteStaff(member)} className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`حذف ${member.name}`}><Trash2 className="h-4 w-4" /></Button></div></article>)}{staff.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-12 text-center"><Scissors className="mx-auto h-10 w-10 text-primary/50" /><h2 className="mt-4 text-lg font-extrabold text-foreground">هنوز پرسنلی ثبت نشده است</h2><p className="mt-2 text-sm text-muted-foreground">اعضای تیم خود را اضافه کنید تا مدیریت سالن کامل‌تر شود.</p></div>}</div></div></div>;
}
