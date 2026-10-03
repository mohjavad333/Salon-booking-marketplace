import type { RequestHandler } from "express";
import { requireUser } from "../middleware/auth";
import { pool } from "../db";
import {
  ensureUpcomingReminders,
  getNotificationPreferences,
  listNotifications,
  markAllRead,
  markRead,
  updateNotificationPreferences,
} from "../services/notification-service";
import { notificationPreferencesSchema } from "../validators/misc";

function mapNotification(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    bookingId: row.booking_id === null ? null : String(row.booking_id),
    type: String(row.type),
    title: String(row.title),
    message: String(row.message),
    isRead: row.is_read === true,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export const handleNotifications: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const user = await requireUser(
      req,
      res,
      "برای مشاهده اعلان‌ها وارد حساب کاربری شوید",
    );
    if (!user) return;
    if (user.role === "customer") await ensureUpcomingReminders(user.id);
    const result = await listNotifications(
      user.id,
      req.query.unreadOnly === "true",
    );
    res.json({
      notifications: result.rows.map(mapNotification),
      unreadCount: result.unreadCount,
    });
  } catch (error: unknown) {
    console.error(
      "Notifications query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "اعلان‌ها در دسترس نیستند" });
  }
};

export const handleMarkNotificationRead: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const user = await requireUser(
      req,
      res,
      "برای مشاهده اعلان‌ها وارد حساب کاربری شوید",
    );
    if (!user) return;
    const read = await markRead(String(req.params.id), user.id);
    if (!read) {
      res.status(404).json({ message: "اعلان پیدا نشد" });
      return;
    }
    res.json({ read: true });
  } catch (error: unknown) {
    console.error(
      "Notification update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "اعلان به‌روزرسانی نشد" });
  }
};

export const handleMarkAllNotificationsRead: RequestHandler = async (
  req,
  res,
) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const user = await requireUser(
      req,
      res,
      "برای مشاهده اعلان‌ها وارد حساب کاربری شوید",
    );
    if (!user) return;
    await markAllRead(user.id);
    res.json({ read: true });
  } catch (error: unknown) {
    console.error(
      "Notifications update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "اعلان‌ها به‌روزرسانی نشدند" });
  }
};

export const handleNotificationPreferences: RequestHandler = async (
  req,
  res,
) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const user = await requireUser(
      req,
      res,
      "برای مشاهده اعلان‌ها وارد حساب کاربری شوید",
    );
    if (!user) return;
    const remindersEnabled = await getNotificationPreferences(user.id);
    res.json({ remindersEnabled });
  } catch (error: unknown) {
    console.error(
      "Notification preferences query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "تنظیمات اعلان در دسترس نیست" });
  }
};

export const handleUpdateNotificationPreferences: RequestHandler = async (
  req,
  res,
) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = notificationPreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "تنظیمات یادآوری معتبر نیست" });
    return;
  }

  try {
    const user = await requireUser(
      req,
      res,
      "برای مشاهده اعلان‌ها وارد حساب کاربری شوید",
    );
    if (!user) return;
    const remindersEnabled = await updateNotificationPreferences(
      user.id,
      parsed.data.remindersEnabled,
    );
    res.json({ remindersEnabled });
  } catch (error: unknown) {
    console.error(
      "Notification preferences update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ذخیره تنظیمات اعلان انجام نشد" });
  }
};
