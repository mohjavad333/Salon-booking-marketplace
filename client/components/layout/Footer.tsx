import { Link } from "react-router-dom";
import { Instagram, Scissors, Send } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="container grid gap-10 py-12 md:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-gold-400 text-primary-foreground">
              <Scissors className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="text-xl font-extrabold text-foreground">
              نوبتو
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
            مارکت‌پلیس رزرو آنلاین نوبت آرایشگاه و سالن‌های زیبایی. جستجو کن،
            زمان خالی رو ببین، در چند ثانیه نوبتت رو رزرو کن.
          </p>
          <div className="mt-5 flex gap-3">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-muted-foreground transition-colors hover:text-primary"
              aria-label="اینستاگرام"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="https://t.me"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-muted-foreground transition-colors hover:text-primary"
              aria-label="تلگرام"
            >
              <Send className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-semibold text-foreground">
            برای کاربران
          </h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              <Link to="/salons" className="hover:text-primary">
                جستجوی سالن
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-primary">
                ورود به حساب
              </Link>
            </li>
            <li>
              <Link to="/register" className="hover:text-primary">
                ثبت‌نام
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-semibold text-foreground">
            برای سالن‌ها
          </h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              <Link to="/for-business" className="hover:text-primary">
                ثبت‌نام سالن
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className="hover:text-primary">
                پنل مدیریت سالن
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-semibold text-foreground">شرکت</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              <Link to="/about" className="hover:text-primary">
                درباره ما
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-primary">
                تماس با ما
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border py-5">
        <p className="container text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} نوبتو. تمامی حقوق محفوظ است.
        </p>
      </div>
    </footer>
  );
}
