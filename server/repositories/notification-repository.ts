import type { Pool } from "pg";

export interface NotificationInput {
  userId: string;
  bookingId?: string | null;
  type: string;
  title: string;
  message: string;
}

const reminderInsert = `
  INSERT INTO notifications (user_id, booking_id, type, title, message)
  SELECT b.customer_id, b.id, 'reminder', 'یادآوری نوبت',
         'نوبت شما در ' || s.name || ' در تاریخ ' || to_char(b.appointment_date, 'YYYY/MM/DD') ||
         ' ساعت ' || to_char(b.appointment_time, 'HH24:MI') || ' است.'
  FROM bookings b
  JOIN salons s ON s.id = b.salon_id
  WHERE %s
    AND b.status IN ('pending', 'confirmed')
    AND COALESCE((SELECT p.reminders_enabled FROM notification_preferences p WHERE p.user_id = b.customer_id), TRUE)
    AND (b.appointment_date + b.appointment_time) > NOW()
    AND (b.appointment_date + b.appointment_time) <= NOW() + INTERVAL '48 hours'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = b.customer_id AND n.booking_id = b.id AND n.type = 'reminder'
    )
  ON CONFLICT (user_id, booking_id, type) DO NOTHING
`;

export async function insertNotification(pool: Pool, input: NotificationInput) {
  await pool.query(
    `INSERT INTO notifications (user_id, booking_id, type, title, message)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, booking_id, type) DO NOTHING`,
    [
      input.userId,
      input.bookingId ?? null,
      input.type,
      input.title,
      input.message,
    ],
  );
}

export async function insertUpcomingReminders(pool: Pool, userId?: string) {
  const condition = userId ? "b.customer_id = $1" : "b.customer_id IS NOT NULL";
  await pool.query(
    reminderInsert.replace("%s", condition),
    userId ? [userId] : [],
  );
}

export async function findUserNotifications(
  pool: Pool,
  userId: string,
  unreadOnly: boolean,
) {
  const [notifications, unread] = await Promise.all([
    pool.query(
      `SELECT id, booking_id, type, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
         AND ($2::boolean = FALSE OR is_read = FALSE)
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId, unreadOnly],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId],
    ),
  ]);
  return {
    rows: notifications.rows,
    unreadCount: Number(unread.rows[0].count),
  };
}

export async function markNotificationRead(
  pool: Pool,
  notificationId: string,
  userId: string,
) {
  const result = await pool.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId],
  );
  return Boolean(result.rowCount);
}

export async function markAllNotificationsRead(pool: Pool, userId: string) {
  await pool.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId],
  );
}

export async function getReminderPreference(pool: Pool, userId: string) {
  const result = await pool.query(
    `SELECT COALESCE(
       (SELECT reminders_enabled FROM notification_preferences WHERE user_id = $1),
       TRUE
     ) AS reminders_enabled`,
    [userId],
  );
  return result.rows[0].reminders_enabled === true;
}

export async function saveReminderPreference(
  pool: Pool,
  userId: string,
  remindersEnabled: boolean,
) {
  const result = await pool.query(
    `INSERT INTO notification_preferences (user_id, reminders_enabled)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
       SET reminders_enabled = EXCLUDED.reminders_enabled, updated_at = NOW()
     RETURNING reminders_enabled`,
    [userId, remindersEnabled],
  );
  return result.rows[0].reminders_enabled === true;
}
