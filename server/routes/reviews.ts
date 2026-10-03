import type { RequestHandler } from "express";
import { requireCustomer } from "../middleware/auth";
import { reviewSchema } from "../validators/misc";
import { databaseReady, pool } from "../db";

function mapReview(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    rating: Number(row.rating),
    comment: String(row.comment),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export const handleSalonReviews: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    await databaseReady;
    const result = await pool.query(
      `SELECT id, rating, comment, created_at
       FROM reviews
       WHERE salon_id = $1
       ORDER BY created_at DESC`,
      [req.params.id],
    );
    res.json({ reviews: result.rows.map(mapReview) });
  } catch (error: unknown) {
    console.error(
      "Salon reviews query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "نظرات سالن در دسترس نیست" });
  }
};

export const handleCreateReview: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "امتیاز یا متن نظر معتبر نیست" });
    return;
  }

  try {
    const user = await requireCustomer(
      req,
      res,
      "برای ثبت نظر وارد حساب کاربری شوید",
      "فقط مشتریان می‌توانند نظر ثبت کنند",
    );
    if (!user) return;
    await databaseReady;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const booking = await client.query(
        `SELECT id FROM bookings
         WHERE id = $1 AND salon_id = $2 AND customer_id = $3 AND status = 'completed'`,
        [parsed.data.bookingId, req.params.id, user.id],
      );
      if (!booking.rowCount) {
        await client.query("ROLLBACK");
        res.status(400).json({
          message: "فقط برای رزرو تکمیل‌شده خود می‌توانید نظر ثبت کنید",
        });
        return;
      }

      const review = await client.query(
        `INSERT INTO reviews (booking_id, customer_id, salon_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, rating, comment, created_at`,
        [
          parsed.data.bookingId,
          user.id,
          req.params.id,
          parsed.data.rating,
          parsed.data.comment,
        ],
      );
      await client.query(
        `UPDATE salons
         SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE salon_id = $1), 0),
             review_count = (SELECT COUNT(*)::int FROM reviews WHERE salon_id = $1)
         WHERE id = $1`,
        [req.params.id],
      );
      await client.query("COMMIT");
      res.status(201).json({ review: mapReview(review.rows[0]) });
    } catch (error) {
      await client.query("ROLLBACK");
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        res
          .status(409)
          .json({ message: "برای این رزرو قبلاً نظر ثبت کرده‌اید" });
        return;
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error(
      "Review creation failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ثبت نظر انجام نشد" });
  }
};
