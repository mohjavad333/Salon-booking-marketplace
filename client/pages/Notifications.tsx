import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronLeft, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

interface NotificationItem { id: string; bookingId: string | null; type: string; title: string; message: string; isRead: boolean; createdAt: string; }
type Filter = "all" | "unread";

function formatDate(value: string) { return new Intl.DateTimeFormat("fa-IR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [error, setError] = useState("");
  const [preferenceError, setPreferenceError] = useState("");

  const loadNotifications = useCallback(async () => {
    setError("");
    const response = await fetch("/api/notifications");
    const data = (await response.json().catch(() => ({}))) as { notifications?: NotificationItem[]; unreadCount?: number; message?: string };
    if (!response.ok) throw new Error(data.message ?? "اعلان‌ها در دسترس نیستند");
    setNotifications(data.notifications ?? []); setUnreadCount(data.unreadCount ?? 0);
  }, []);

  const loadPreferences = useCallback(async () => {
    setPreferenceError("");
    const response = await fetch("/api/notifications/preferences");
    const data = (await response.json().catch(() => ({}))) as { remindersEnabled?: boolean; message?: string };
    if (!response.ok) throw new Error(data.message ?? "تنظیمات اعلان در دسترس نیست");
    setRemindersEnabled(data.remindersEnabled !== false);
  }, []);

  useEffect(() => {
    Promise.allSettled([loadNotifications(), loadPreferences()]).then((results) => {
      if (results[0].status === "rejected") setError(results[0].reason instanceof Error ? results[0].reason.message : "اعلان‌ها در دسترس نیستند");
      if (results[1].status === "rejected") setPreferenceError(results[1].reason instanceof Error ? results[1].reason.message : "تنظیمات اعلان در دسترس نیست");
      setLoading(false);
    });
  }, [loadNotifications, loadPreferences]);

  const visibleNotifications = useMemo(() => notifications.filter((notification) => filter === "all" || !notification.isRead), [filter, notifications]);

  const markRead = async (id: string) => {
    const response = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    if (!response.ok) return;
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, isRead: true } : notification));
    setUnreadCount((count) => Math.max(0, count - 1));
  };

  const markAllRead = async () => {
    const response = await fetch("/api/notifications/read-all", { method: "POST" });
    if (!response.ok) return;
    setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true }))); setUnreadCount(0);
  };

  const updateReminders = async () => {
    const nextValue = !remindersEnabled;
    setPreferenceSaving(true); setPreferenceError("");
    try {
      const response = await fetch("/api/notifications/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remindersEnabled: nextValue }) });
      const data = (await response.json().catch(() => ({}))) as { remindersEnabled?: boolean; message?: string };
      if (!response.ok) throw new Error(data.message ?? "ذخیره تنظیمات انجام نشد");
      setRemindersEnabled(data.remindersEnabled !== false);
    } catch (reason: unknown) { setPreferenceError(reason instanceof Error ? reason.message : "ذخیره تنظیمات انجام نشد"); }
    finally { setPreferenceSaving(false); }
  };

  const retry = async () => { setRetrying(true); try { await Promise.all([loadNotifications(), loadPreferences()]); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "اعلان‌ها در دسترس نیستند"); } finally { setRetrying(false); } };

  if (loading) return <div className="container flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">در حال دریافت اعلان‌ها...</div>;

  return <div className="bg-secondary/30 py-8"><div className="container max-w-3xl"><div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">حساب کاربری نوبتو</p><h1 className="mt-1 text-2xl font-extrabold text-foreground md:text-3xl">مرکز اعلان‌ها</h1><p className="mt-2 text-sm text-muted-foreground">یادآوری‌ها و تغییرات مربوط به رزروها را اینجا ببینید.</p></div>{unreadCount > 0 && <Button variant="outline" onClick={() => void markAllRead()} className="gap-2"><CheckCheck className="h-4 w-4" />خواندن همه</Button>}</div>{error ? <div className="rounded-2xl border border-destructive/20 bg-card p-8 text-center"><Bell className="mx-auto h-10 w-10 text-destructive" /><p className="mt-4 text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => void retry()} disabled={retrying} className="mt-5 gap-2"><RefreshCw className="h-4 w-4" />{retrying ? "در حال تلاش..." : "تلاش دوباره"}</Button></div> : <><section className="mb-5 rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-sm font-extrabold text-foreground">تنظیمات یادآوری</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">برای رزروهای نزدیک، یک اعلان یادآوری دریافت کنید.</p></div><button type="button" role="switch" aria-checked={remindersEnabled} aria-label="فعال‌سازی یادآوری رزرو" onClick={() => void updateReminders()} disabled={preferenceSaving} className={`relative h-6 w-11 rounded-full transition-colors ${remindersEnabled ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${remindersEnabled ? "right-1" : "right-6"}`} /></button></div>{preferenceError && <p className="mt-3 text-xs text-destructive">{preferenceError}</p>}</section><div className="mb-5 flex gap-2 rounded-2xl border border-border bg-card p-2"><button onClick={() => setFilter("all")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>همه اعلان‌ها</button><button onClick={() => setFilter("unread")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${filter === "unread" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>خوانده‌نشده‌ها {unreadCount > 0 && `(${unreadCount})`}</button></div>{visibleNotifications.length === 0 ? <div className="rounded-2xl border border-border bg-card p-12 text-center"><Bell className="mx-auto h-10 w-10 text-muted-foreground/40" /><h2 className="mt-4 text-lg font-extrabold text-foreground">اعلانی برای نمایش وجود ندارد</h2><p className="mt-2 text-sm text-muted-foreground">در صورت تغییر وضعیت رزرو، پیام آن را همین‌جا دریافت می‌کنید.</p><Button asChild className="mt-5 gap-2"><Link to={user?.role === "salon" ? "/dashboard" : user?.role === "admin" ? "/admin" : "/salons"}>بازگشت <ChevronLeft className="h-4 w-4" /></Link></Button></div> : <div className="space-y-3">{visibleNotifications.map((notification) => <article key={notification.id} className={`rounded-2xl border bg-card p-5 transition-colors ${notification.isRead ? "border-border" : "border-primary/30 bg-primary/[0.03]"}`}><div className="flex items-start gap-3"><span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${notification.isRead ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"}`}><Bell className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-sm font-extrabold text-foreground">{notification.title}</h2><time className="text-xs text-muted-foreground">{formatDate(notification.createdAt)}</time></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{notification.message}</p><div className="mt-4 flex flex-wrap gap-2">{notification.bookingId && <Button asChild variant="outline" size="sm"><Link to={user?.role === "salon" ? "/dashboard" : user?.role === "admin" ? "/admin" : "/my-bookings"}>مشاهده رزرو <ChevronLeft className="h-3.5 w-3.5" /></Link></Button>}{!notification.isRead && <Button variant="ghost" size="sm" onClick={() => void markRead(notification.id)}>علامت‌گذاری به‌عنوان خوانده‌شده</Button>}</div></div></div></article>)}</div>}</>}</div></div>;
}
