import type { RequestHandler } from "express";
import { requireCustomer } from "../middleware/auth";
import { databaseReady, pool } from "../db";

function mapFavorite(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    city: String(row.city),
    area: String(row.area),
    category: String(row.category),
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    startingPrice: Number(row.starting_price),
    image: String(row.image),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  };
}

const favoriteSalonQuery = `
  SELECT s.id, s.name, s.city, s.area, s.category, s.rating,
         s.review_count, s.starting_price, s.image, s.tags
  FROM favorites f
  JOIN salons s ON s.id = f.salon_id
`;

export const handleMyFavorites: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const user = await requireCustomer(
      req,
      res,
      "برای مدیریت علاقه‌مندی‌ها وارد حساب کاربری شوید",
      "فقط مشتریان می‌توانند سالن موردعلاقه ذخیره کنند",
    );
    if (!user) return;
    await databaseReady;
    const result = await pool.query(
      `${favoriteSalonQuery} WHERE f.customer_id = $1 AND s.is_active = TRUE AND s.approval_status = 'approved' ORDER BY f.created_at DESC`,
      [user.id],
    );
    res.json({ salons: result.rows.map(mapFavorite) });
  } catch (error: unknown) {
    console.error(
      "Favorites query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "علاقه‌مندی‌ها در دسترس نیست" });
  }
};

export const handleFavoriteStatus: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const user = await requireCustomer(
      req,
      res,
      "برای مدیریت علاقه‌مندی‌ها وارد حساب کاربری شوید",
      "فقط مشتریان می‌توانند سالن موردعلاقه ذخیره کنند",
    );
    if (!user) return;
    await databaseReady;
    const result = await pool.query(
      `SELECT 1 FROM favorites f
       JOIN salons s ON s.id = f.salon_id
       WHERE f.customer_id = $1 AND f.salon_id = $2
         AND s.is_active = TRUE AND s.approval_status = 'approved'`,
      [user.id, req.params.salonId],
    );
    res.json({ favorite: Boolean(result.rowCount) });
  } catch (error: unknown) {
    console.error(
      "Favorite status query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "وضعیت علاقه‌مندی در دسترس نیست" });
  }
};

export const handleAddFavorite: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const user = await requireCustomer(
      req,
      res,
      "برای مدیریت علاقه‌مندی‌ها وارد حساب کاربری شوید",
      "فقط مشتریان می‌توانند سالن موردعلاقه ذخیره کنند",
    );
    if (!user) return;
    await databaseReady;
    const salon = await pool.query(
      `SELECT 1 FROM salons WHERE id = $1 AND is_active = TRUE AND approval_status = 'approved'`,
      [req.params.salonId],
    );
    if (!salon.rowCount) {
      res.status(404).json({ message: "سالن موردنظر پیدا نشد" });
      return;
    }
    await pool.query(
      `INSERT INTO favorites (customer_id, salon_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, req.params.salonId],
    );
    res.status(201).json({ favorite: true });
  } catch (error: unknown) {
    console.error(
      "Favorite creation failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ذخیره علاقه‌مندی انجام نشد" });
  }
};

export const handleRemoveFavorite: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const user = await requireCustomer(
      req,
      res,
      "برای مدیریت علاقه‌مندی‌ها وارد حساب کاربری شوید",
      "فقط مشتریان می‌توانند سالن موردعلاقه ذخیره کنند",
    );
    if (!user) return;
    await databaseReady;
    await pool.query(
      `DELETE FROM favorites WHERE customer_id = $1 AND salon_id = $2`,
      [user.id, req.params.salonId],
    );
    res.json({ favorite: false });
  } catch (error: unknown) {
    console.error(
      "Favorite removal failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "حذف علاقه‌مندی انجام نشد" });
  }
};
