import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Calendar,
  ChevronLeft,
  MapPin,
  Percent,
  Search,
  Shield,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import SalonCard from "@/components/salon-card";
import { categories, cities, salons } from "@/lib/salons-data";

export default function Index() {
  const navigate = useNavigate();
  const [city, setCity] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (category) params.set("category", category);
    navigate(`/salons${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const featured = salons.slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-secondary/60 to-background">
        <div className="pointer-events-none absolute -top-32 right-[-10%] h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute top-40 left-[-10%] h-80 w-80 rounded-full bg-gold-300/30 blur-3xl" />

        <div className="container relative grid gap-12 pb-16 pt-14 md:grid-cols-2 md:items-center md:pt-20">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              مارکت‌پلیس نوبت‌دهی آرایشگاه و سالن زیبایی
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-[1.3] text-foreground md:text-5xl">
              زیباتر شو، نوبتت رو
              <span className="bg-gradient-to-l from-primary to-gold-500 bg-clip-text text-transparent">
                {" "}
                آنلاین{" "}
              </span>
              رزرو کن
            </h1>
            <p className="mt-4 max-w-lg text-base leading-8 text-muted-foreground">
              بهترین آرایشگاه‌ها و سالن‌های زیبایی شهرت رو پیدا کن، زمان‌های
              خالی رو ببین و در کمتر از دو دقیقه نوبتت رو رزرو کن؛ بدون تماس
              تلفنی و بدون معطلی.
            </p>

            <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg shadow-primary/5 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 rounded-xl px-2 sm:border-l sm:border-border">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="h-11 border-0 shadow-none focus:ring-0">
                    <SelectValue placeholder="انتخاب شهر" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-xl px-2">
                <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-11 border-0 shadow-none focus:ring-0">
                    <SelectValue placeholder="نوع خدمات" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="lg"
                onClick={handleSearch}
                className="h-12 gap-2 shadow-md shadow-primary/20"
              >
                <Search className="h-4 w-4" />
                جستجوی سالن‌ها
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <div>
                <span className="text-lg font-extrabold text-foreground">
                  ۵۰۰+
                </span>{" "}
                سالن فعال
              </div>
              <div>
                <span className="text-lg font-extrabold text-foreground">
                  ۲۰,۰۰۰+
                </span>{" "}
                رزرو موفق
              </div>
              <div>
                <span className="text-lg font-extrabold text-foreground">
                  ۴.۸
                </span>{" "}
                میانگین رضایت
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="overflow-hidden rounded-3xl border border-border shadow-2xl shadow-primary/10">
              <img
                src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=900&auto=format&fit=crop"
                alt="سالن زیبایی"
                className="h-[420px] w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -right-4 w-64 rounded-2xl border border-border bg-card p-4 shadow-xl sm:right-[-2rem]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Calendar className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    نوبت شما ثبت شد
                  </p>
                  <p className="text-xs text-muted-foreground">
                    یکشنبه، ساعت ۱۷:۳۰
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container py-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-foreground md:text-2xl">
            دسته‌بندی خدمات
          </h2>
        </div>
        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <Link
              key={cat}
              to={`/salons?category=${encodeURIComponent(cat)}`}
              className="shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured salons */}
      <section className="container py-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-foreground md:text-2xl">
              سالن‌های محبوب
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              انتخاب‌های برتر کاربران نوبتو
            </p>
          </div>
          <Link
            to="/salons"
            className="flex items-center gap-1 text-sm font-semibold text-primary"
          >
            مشاهده همه
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((salon) => (
            <SalonCard key={salon.id} salon={salon} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-secondary/40 py-16">
        <div className="container">
          <h2 className="text-center text-xl font-extrabold text-foreground md:text-2xl">
            رزرو نوبت در سه قدم ساده
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: "جستجو کن",
                desc: "سالن مورد نظرت رو بر اساس شهر، منطقه، نوع خدمات یا امتیاز پیدا کن.",
              },
              {
                icon: Calendar,
                title: "زمان خالی رو انتخاب کن",
                desc: "تقویم زمان‌های خالی هر سالن رو ببین و روز و ساعت دلخواهت رو انتخاب کن.",
              },
              {
                icon: Shield,
                title: "رزرو و پرداخت امن",
                desc: "نوبتت رو با پرداخت آنلاین امن نهایی کن و یادآوری پیامکی دریافت کن.",
              },
            ].map((step, i) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-border bg-card p-6"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="h-6 w-6" />
                </span>
                <span className="absolute left-6 top-6 text-3xl font-extrabold text-border">
                  {`۰${i + 1}`}
                </span>
                <h3 className="mt-5 text-base font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For business CTA */}
      <section className="container py-16">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-gradient-to-l from-primary to-gold-500 p-8 text-primary-foreground md:grid-cols-2 md:p-12">
          <div>
            <h2 className="text-2xl font-extrabold md:text-3xl">
              صاحب آرایشگاه یا سالن زیبایی هستید؟
            </h2>
            <p className="mt-4 leading-7 text-primary-foreground/90">
              با پیوستن به نوبتو، پروفایل اختصاصی بساز، خدمات و پرسنلت رو
              معرفی کن، تقویم نوبت‌دهی داشته باش و مشتری‌های جدید جذب کن.
            </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="mt-6 text-foreground"
            >
              <Link to="/for-business">ثبت‌نام رایگان سالن</Link>
            </Button>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              "پنل مدیریت اختصاصی",
              "تعریف خدمات، قیمت و پرسنل",
              "نمایش زمان‌های خالی به‌صورت زنده",
              "کارمزد شفاف و منصفانه",
            ].map((item) => (
              <li
                key={item}
                className="rounded-xl bg-white/10 px-4 py-3 text-sm font-medium backdrop-blur-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Trust features */}
      <section className="container pb-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Shield,
              title: "پرداخت امن",
              desc: "پرداخت آنلاین با درگاه‌های معتبر بانکی",
            },
            {
              icon: Bell,
              title: "یادآوری هوشمند",
              desc: "پیامک یادآوری نوبت پیش از موعد",
            },
            {
              icon: Zap,
              title: "رزرو سریع",
              desc: "رزرو نوبت در کمتر از دو دقیقه",
            },
            {
              icon: Percent,
              title: "کارمزد منصفانه",
              desc: "مدل درآمدی شفاف برای سالن‌ها",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-sm font-bold text-foreground">
                {f.title}
              </h3>
              <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-secondary/40 py-16">
        <div className="container">
          <h2 className="text-center text-xl font-extrabold text-foreground md:text-2xl">
            نظر کاربران نوبتو
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                name: "سارا محمدی",
                text: "خیلی راحت تونستم نوبت آرایشگاه موردعلاقه‌ام رو بدون تماس تلفنی رزرو کنم.",
              },
              {
                name: "علی رضایی",
                text: "پنل مدیریت سالنم رو با نوبتو راه انداختم و مشتری‌های جدید زیادی جذب کردم.",
              },
              {
                name: "نگار احمدی",
                text: "یادآوری پیامکی نوبت خیلی به دردم خورد، دیگه هیچ نوبتی رو فراموش نمی‌کنم.",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex gap-1 text-gold-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-gold-500" />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  «{t.text}»
                </p>
                <p className="mt-4 text-sm font-bold text-foreground">
                  {t.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
