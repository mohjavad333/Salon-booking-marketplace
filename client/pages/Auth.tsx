import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Scissors, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";

function normalizePhone(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^0-9]/g, "");
}

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuthenticatedUser } = useAuth();
  const isRegister = location.pathname === "/register";
  const [role, setRole] = useState<"customer" | "salon">("customer");
  const [authenticatedRole, setAuthenticatedRole] = useState<"customer" | "salon" | "admin">("customer");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const phone = normalizePhone(String(form.get("phone") ?? ""));
    const password = String(form.get("password") ?? "");
    const salonName = String(form.get("salonName") ?? "").trim();

    if (!/^09\d{9}$/.test(phone)) {
      setError("شماره موبایل را به‌صورت ۱۱ رقمی و با ۰۹ وارد کنید.");
      return;
    }
    if (password.length < 6) {
      setError("رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }
    if (isRegister && role === "salon" && salonName.length < 2) {
      setError("نام سالن را وارد کنید.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          password,
          ...(isRegister ? { role, salonName: role === "salon" ? salonName : null } : role === "salon" ? { role } : {}),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; user?: Parameters<typeof setAuthenticatedUser>[0] };
      if (!response.ok || !data.user) {
        setError(data.message ?? "ارتباط با سرور انجام نشد.");
        return;
      }
      setAuthenticatedUser(data.user);
      setAuthenticatedRole(data.user.role);
      setSubmitted(true);
    } catch {
      setError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const destination = searchParams.get("next") || (authenticatedRole === "admin" ? "/admin" : authenticatedRole === "salon" ? "/dashboard" : "/salons");
    return (
      <div className="container flex min-h-[75vh] items-center justify-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl shadow-primary/5">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold text-foreground">
            {isRegister ? "حساب شما ساخته شد" : "ورود با موفقیت انجام شد"}
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {authenticatedRole === "admin"
              ? "به پنل مدیریت نوبتو خوش آمدید. وضعیت کلی مارکت‌پلیس را مدیریت کنید."
              : authenticatedRole === "salon"
                ? "به پنل مدیریت سالن خوش آمدید. حالا می‌توانید خدمات و زمان‌های خالی را مدیریت کنید."
                : "حالا می‌توانید سالن موردنظرتان را پیدا کنید و نوبت آنلاین بگیرید."}
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate(destination, { replace: true })}>
            {authenticatedRole === "admin" ? "ورود به پنل مدیریت" : authenticatedRole === "salon" ? "ورود به پنل سالن" : "جستجوی سالن‌ها"}
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container grid min-h-[78vh] items-center gap-12 py-12 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <Scissors className="h-4 w-4 text-primary" />
          بازگشت به نوبتو
        </Link>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">
          <div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {isRegister ? <Sparkles className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
            </span>
            <h1 className="mt-5 text-2xl font-extrabold text-foreground">
              {isRegister ? "به نوبتو خوش آمدید" : "ورود به حساب کاربری"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isRegister ? "برای شروع، نوع حساب خود را انتخاب کنید." : "برای ادامه شماره موبایل و رمز عبور خود را وارد کنید."}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-secondary/70 p-1" role="tablist" aria-label="نوع حساب">
            <button type="button" role="tab" aria-selected={role === "customer"} onClick={() => { setRole("customer"); setError(""); }} className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${role === "customer" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
              کاربر نوبتو
            </button>
            <button type="button" role="tab" aria-selected={role === "salon"} onClick={() => { setRole("salon"); setError(""); }} className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${role === "salon" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
              صاحب سالن
            </button>
          </div>

          {!forgotOpen ? <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {isRegister && role === "salon" && (
              <div>
                <label htmlFor="salonName" className="mb-2 block text-sm font-medium text-foreground">نام سالن</label>
                <Input id="salonName" name="salonName" placeholder="مثلاً سالن زیبایی ویولا" required className="h-11" />
              </div>
            )}
            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-medium text-foreground">شماره موبایل</label>
              <Input id="phone" name="phone" type="tel" inputMode="numeric" dir="ltr" placeholder="۰۹۱۲۱۲۳۴۵۶۷" required className="h-11 text-right" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-foreground">رمز عبور</label>
                {!isRegister && <button type="button" onClick={() => { setForgotOpen(true); setError(""); }} className="text-xs font-medium text-primary hover:underline">فراموشی رمز عبور</button>}
              </div>
              <div className="relative">
                <Input id="password" name="password" type={showPassword ? "text" : "password"} minLength={6} placeholder="حداقل ۶ کاراکتر" required className="h-11 pl-11" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? "مخفی‌کردن رمز عبور" : "نمایش رمز عبور"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {isRegister && (
              <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <input type="checkbox" required className="mt-1 accent-primary" />
                با قوانین و شرایط استفاده از نوبتو موافقم.
              </label>
            )}
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="h-12 w-full">
              {submitting ? "در حال بررسی..." : isRegister ? "ساخت حساب کاربری" : "ورود به نوبتو"}
              {!submitting && <ArrowLeft className="h-4 w-4" />}
            </Button>
          </form> : <div className="mt-6 rounded-2xl border border-primary/15 bg-primary/5 p-5">
            <h2 className="text-base font-bold text-foreground">بازیابی رمز عبور</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">برای حفظ امنیت حساب، بازیابی رمز عبور از طریق پشتیبانی نوبتو انجام می‌شود. شماره موبایلی که با آن ثبت‌نام کرده‌اید را همراه داشته باشید.</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1"><Link to="/contact">تماس با پشتیبانی</Link></Button>
              <Button type="button" variant="outline" onClick={() => setForgotOpen(false)} className="flex-1">بازگشت به ورود</Button>
            </div>
          </div>}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isRegister ? "قبلاً حساب ساخته‌اید؟" : "هنوز در نوبتو ثبت‌نام نکرده‌اید؟"}{" "}
            <Link to={isRegister ? "/login" : "/register"} className="font-bold text-primary hover:underline">
              {isRegister ? "ورود" : "ثبت‌نام کنید"}
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-gold-500 p-10 text-primary-foreground lg:block">
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm"><Sparkles className="h-7 w-7" /></span>
          <h2 className="mt-8 text-3xl font-extrabold leading-relaxed">زیبایی، همین‌قدر ساده.</h2>
          <p className="mt-4 max-w-sm text-sm leading-8 text-primary-foreground/85">با نوبتو به بهترین سالن‌های شهر دسترسی داشته باش و نوبتت را هرجا که هستی، در چند ثانیه رزرو کن.</p>
          <div className="mt-10 space-y-4">
            {["رزرو آنلاین بدون تماس تلفنی", "یادآوری خودکار نوبت", "پرداخت امن و پشتیبانی همراه"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-medium"><CheckCircle2 className="h-5 w-5 shrink-0" />{item}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
