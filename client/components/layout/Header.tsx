import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  LogOut,
  Menu,
  Scissors,
  UserCircle,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const navLinks = [
  { to: "/", label: "خانه" },
  { to: "/salons", label: "سالن‌ها" },
  { to: "/for-business", label: "برای صاحبان سالن" },
];

interface NotificationItem {
  id: string;
  bookingId: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notifications");
      const data = (await response.json().catch(() => ({}))) as {
        notifications?: NotificationItem[];
        unreadCount?: number;
        message?: string;
      };
      if (!response.ok)
        throw new Error(data.message ?? "اعلان‌ها در دسترس نیستند");
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "اعلان‌ها در دسترس نیستند",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 60_000);
    return () => window.clearInterval(interval);
  }, [loadNotifications, user]);

  const markRead = async (notification: NotificationItem) => {
    if (notification.isRead) return;
    const response = await fetch(`/api/notifications/${notification.id}/read`, {
      method: "PATCH",
    });
    if (!response.ok) return;
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, isRead: true } : item,
      ),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  };

  const markAllRead = async () => {
    const response = await fetch("/api/notifications/read-all", {
      method: "POST",
    });
    if (!response.ok) return;
    setNotifications((current) =>
      current.map((item) => ({ ...item, isRead: true })),
    );
    setUnreadCount(0);
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void loadNotifications();
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="اعلان‌ها"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "۹+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-[60] w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-extrabold text-foreground">اعلان‌ها</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {unreadCount
                  ? `${unreadCount} اعلان خوانده‌نشده`
                  : "همه اعلان‌ها خوانده شده‌اند"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                خواندن همه
              </button>
            )}
          </div>
          <div className="max-h-[min(65vh,420px)] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                در حال دریافت اعلان‌ها...
              </p>
            ) : error ? (
              <p className="px-4 py-8 text-center text-sm text-destructive">
                {error}
              </p>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  اعلان جدیدی ندارید.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => void markRead(notification)}
                  className={cn(
                    "block w-full border-b border-border px-4 py-3 text-right transition-colors last:border-0 hover:bg-secondary/70",
                    !notification.isRead && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        notification.isRead ? "bg-transparent" : "bg-primary",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {notification.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatNotificationDate(notification.createdAt)}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {notification.message}
                      </span>
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-3 text-center text-xs font-semibold text-primary hover:bg-secondary"
          >
            مشاهده همه اعلان‌ها
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-gold-400 text-primary-foreground shadow-sm">
            <Scissors className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-foreground">
            نوبتو
          </span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                location.pathname === link.to && "bg-secondary text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              <NotificationCenter />
              {user.role === "admin" ? (
                <Button variant="ghost" asChild>
                  <Link to="/admin">پنل مدیریت</Link>
                </Button>
              ) : user.role === "salon" ? (
                <>
                  <Button variant="ghost" asChild>
                    <Link to="/dashboard">داشبورد سالن</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link to="/dashboard/staff">پرسنل</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link to="/dashboard/reports">گزارش‌ها</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link to="/dashboard/settings">تنظیمات</Link>
                  </Button>
                </>
              ) : (
                <Button variant="ghost" asChild>
                  <Link to="/my-bookings">پنل مشتری</Link>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleLogout}
                className="gap-2"
              >
                <UserCircle className="h-4 w-4" />
                {user.phone}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">ورود</Link>
              </Button>
              <Button asChild className="shadow-sm shadow-primary/20">
                <Link to="/register">ثبت‌نام</Link>
              </Button>
            </>
          )}
        </div>
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "بستن منو" : "باز کردن منو"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-4 pb-4 pt-2 lg:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
                  location.pathname === link.to &&
                    "bg-secondary text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {user && (
            <div className="mt-3 border-t border-border pt-3">
              <NotificationCenter />
              {user.role === "salon" && (
                <nav
                  className="mt-3 grid grid-cols-2 gap-2"
                  aria-label="دسترسی‌های سالن"
                >
                  <Link
                    to="/dashboard/staff"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    پرسنل
                  </Link>
                  <Link
                    to="/dashboard/schedule"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    تقویم
                  </Link>
                  <Link
                    to="/dashboard/reports"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    گزارش‌ها
                  </Link>
                  <Link
                    to="/dashboard/settings"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    تنظیمات
                  </Link>
                </nav>
              )}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {user ? (
              <>
                <Button
                  variant="outline"
                  asChild
                  className="flex-1"
                  onClick={() => setOpen(false)}
                >
                  <Link
                    to={
                      user.role === "admin"
                        ? "/admin"
                        : user.role === "salon"
                          ? "/dashboard"
                          : "/my-bookings"
                    }
                  >
                    {user.role === "admin"
                      ? "پنل مدیریت"
                      : user.role === "salon"
                        ? "داشبورد سالن"
                        : "پنل مشتری"}
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  خروج
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  asChild
                  className="flex-1"
                  onClick={() => setOpen(false)}
                >
                  <Link to="/login">ورود</Link>
                </Button>
                <Button
                  asChild
                  className="flex-1"
                  onClick={() => setOpen(false)}
                >
                  <Link to="/register">ثبت‌نام</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
