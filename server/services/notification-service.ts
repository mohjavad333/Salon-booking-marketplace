import { databaseReady, pool } from "../db";
import {
  getReminderPreference,
  findUserNotifications,
  insertNotification,
  insertUpcomingReminders,
  markAllNotificationsRead,
  markNotificationRead,
  saveReminderPreference,
  type NotificationInput,
} from "../repositories/notification-repository";

export type { NotificationInput } from "../repositories/notification-repository";

export async function createNotification(input: NotificationInput) {
  if (!pool) return;
  try {
    await databaseReady;
    await insertNotification(pool, input);
  } catch (error: unknown) {
    console.error(
      "Notification creation failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function ensureUpcomingReminders(userId: string) {
  if (!pool) return;
  await databaseReady;
  await insertUpcomingReminders(pool, userId);
}

export async function runReminderWorker() {
  if (!pool) return;
  try {
    await databaseReady;
    await insertUpcomingReminders(pool);
  } catch (error: unknown) {
    console.error(
      "Reminder worker failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

let reminderWorkerStarted = false;

export function startReminderWorker() {
  if (reminderWorkerStarted) return;
  reminderWorkerStarted = true;
  void runReminderWorker();
  const interval = setInterval(() => void runReminderWorker(), 60 * 60 * 1000);
  interval.unref();
}

export async function listNotifications(userId: string, unreadOnly: boolean) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;
  return findUserNotifications(pool, userId, unreadOnly);
}

export async function markRead(notificationId: string, userId: string) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;
  return markNotificationRead(pool, notificationId, userId);
}

export async function markAllRead(userId: string) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;
  await markAllNotificationsRead(pool, userId);
}

export async function getNotificationPreferences(userId: string) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;
  return getReminderPreference(pool, userId);
}

export async function updateNotificationPreferences(
  userId: string,
  remindersEnabled: boolean,
) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;
  return saveReminderPreference(pool, userId, remindersEnabled);
}
