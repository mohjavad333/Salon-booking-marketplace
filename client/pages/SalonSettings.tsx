import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Check, Clock3, ShieldCheck, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SalonSettings() {
  const [hours, setHours] = useState("24");
  const [policy, setPolicy] = useState("لغو رایگان تا ۲۴ ساعت قبل از نوبت");
  const [depositType, setDepositType] = useState<"none" | "fixed" | "percentage">("none");
  const [depositValue, setDepositValue] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/owner/settings")
      .then(async (response) => { const data = (await response.json().catch(() => ({}))) as { cancellationWindowHours?: number; cancellationPolicy?: string; depositType?: "none" | "fixed" | "percentage"; depositValue?: number; message?: string }; if (!response.ok) throw new Error(data.message ?? "تنظیمات سالن در دسترس نیست"); setHours(String(data.cancellationWindowHours ?? 24)); setPolicy(data.cancellationPolicy ?? ""); setDepositType(data.depositType ?? "none"); setDepositValue(String(data.depositValue ?? 0)); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "تنظیمات سالن در دسترس نیست"))
      .finally(() => setLoading(false));
  }, []);

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setSaved(false); setError("");
    try {
      const response = await fetch("/api/owner/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancellationWindowHours: Number(hours), cancellationPolicy: policy, depositType, depositValue: Number(depositValue) }) });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "ذخیره تنظیمات انجام نشد");
      setSaved(true);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "ذخیره تنظیمات انجام نشد"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="container flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">در حال دریافت تنظیمات سالن...</div>;

  return <div className="bg-secondary/30 py-8"><div className="container max-w-3xl"><Link to="/dashboard" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowRight className="h-4 w-4" />بازگشت به داشبورد</Link><div className="mb-8"><p className="text-sm text-muted-foreground">تنظیمات کسب‌وکار</p><h1 className="mt-1 text-2xl font-extrabold text-foreground md:text-3xl">قوانین سالن</h1><p className="mt-2 text-sm text-muted-foreground">قوانین لغو را مشخص کنید تا مشتری قبل از رزرو از آن مطلع باشد.</p></div>{error && <div className="mb-5 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"><XCircle className="h-4 w-4" />{error}</div>}<form onSubmit={saveSettings} className="rounded-2xl border border-border bg-card p-5 sm:p-7"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-lg font-extrabold text-foreground">قانون لغو رزرو</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">مشتری تا این بازه قبل از زمان نوبت امکان لغو رایگان دارد.</p></div></div><div className="mt-6 rounded-xl bg-secondary/60 p-4"><p className="text-sm font-bold text-foreground">بیعانه رزرو</p><p className="mt-1 text-xs text-muted-foreground">مبلغی که قبل از نهایی‌شدن پرداخت درگاه از مشتری دریافت خواهد شد.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-muted-foreground">نوع بیعانه<select value={depositType} onChange={(event) => setDepositType(event.target.value as "none" | "fixed" | "percentage")} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="none">بدون بیعانه</option><option value="fixed">مبلغ ثابت</option><option value="percentage">درصدی از مبلغ خدمت</option></select></label><label className="text-xs font-semibold text-muted-foreground">{depositType === "percentage" ? "درصد بیعانه" : "مبلغ بیعانه"}<Input type="number" min="0" max={depositType === "percentage" ? 100 : 1000000000} value={depositValue} disabled={depositType === "none"} onChange={(event) => setDepositValue(event.target.value)} className="mt-1" /></label></div></div><div className="mt-6 grid gap-5 sm:grid-cols-[220px_1fr]"><div><label htmlFor="cancellation-hours" className="mb-2 block text-sm font-semibold text-foreground">مهلت لغو رایگان</label><div className="relative"><Clock3 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="cancellation-hours" type="number" min="0" max="168" value={hours} onChange={(event) => setHours(event.target.value)} className="pr-9" dir="ltr" required /></div><p className="mt-1.5 text-xs text-muted-foreground">برحسب ساعت؛ صفر یعنی لغو تا قبل از نوبت.</p></div><div><label htmlFor="cancellation-policy" className="mb-2 block text-sm font-semibold text-foreground">متن قوانین</label><textarea id="cancellation-policy" value={policy} onChange={(event) => setPolicy(event.target.value)} maxLength={500} minLength={10} required className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary" /></div></div>{saved && <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><Check className="h-4 w-4" />قوانین با موفقیت ذخیره شد.</div>}<Button type="submit" disabled={saving} className="mt-6">{saving ? "در حال ذخیره..." : "ذخیره قوانین"}</Button></form></div></div>;
}
