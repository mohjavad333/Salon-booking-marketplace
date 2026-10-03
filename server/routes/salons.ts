import type { RequestHandler } from "express";
import { databaseReady, pool } from "../db";

function queryString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function mapSalon(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    city: String(row.city),
    area: String(row.area),
    category: String(row.category),
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    startingPrice: Number(row.starting_price),
    cancellationWindowHours: Number(row.cancellation_window_hours ?? 24),
    cancellationPolicy: String(
      row.cancellation_policy ?? "لغو رایگان تا ۲۴ ساعت قبل از نوبت",
    ),
    depositType: String(row.deposit_type ?? "none"),
    depositValue: Number(row.deposit_value ?? 0),
    image: String(row.image),
    description: String(row.description ?? ""),
    address: String(row.address ?? ""),
    phone: row.phone ? String(row.phone) : null,
    instagram: row.instagram ? String(row.instagram) : null,
    galleryImages: Array.isArray(row.gallery_images)
      ? row.gallery_images.map(String)
      : [],
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  };
}

export const handleSalons: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    await databaseReady;
    const values: Array<string | string[]> = [];
    const conditions: string[] = [];
    const city = queryString(req.query.city);
    const rawCategories = Array.isArray(req.query.category)
      ? req.query.category.filter(
          (value): value is string => typeof value === "string",
        )
      : [queryString(req.query.category)].filter(Boolean);
    const search = queryString(req.query.q);
    const minRating = Number(req.query.minRating);

    if (city) {
      values.push(city);
      conditions.push(`city = $${values.length}`);
    }
    if (rawCategories.length > 0) {
      values.push(rawCategories);
      conditions.push(`category = ANY($${values.length})`);
    }
    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(name ILIKE $${values.length} OR array_to_string(tags, ' ') ILIKE $${values.length})`,
      );
    }
    if (Number.isFinite(minRating) && minRating > 0) {
      values.push(String(minRating));
      conditions.push(`rating >= $${values.length}`);
    }

    const sort = queryString(req.query.sort);
    const orderBy =
      sort === "rating"
        ? "rating DESC, review_count DESC"
        : sort === "price-asc"
          ? "starting_price ASC"
          : "review_count DESC";
    const where = `WHERE is_active = TRUE AND approval_status = 'approved'${conditions.length > 0 ? ` AND ${conditions.join(" AND ")}` : ""}`;
    const result = await pool.query(
      `SELECT id, name, city, area, category, rating, review_count, starting_price,
              cancellation_window_hours, cancellation_policy, deposit_type, deposit_value, image, description, address, phone, instagram, gallery_images, tags
       FROM salons ${where} ORDER BY ${orderBy}`,
      values,
    );

    res.json({ salons: result.rows.map(mapSalon) });
  } catch (error) {
    console.error(
      "Salon list query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "Unable to load salons" });
  }
};

export const handleSalonById: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  try {
    await databaseReady;
    const result = await pool.query(
      `SELECT id, name, city, area, category, rating, review_count, starting_price,
              cancellation_window_hours, cancellation_policy, deposit_type, deposit_value, image, description, address, phone, instagram, gallery_images, tags
       FROM salons
       WHERE id = $1 AND is_active = TRUE AND approval_status = 'approved'`,
      [req.params.id],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Salon not found" });
      return;
    }

    const services = await pool.query(
      `SELECT id, title, duration_minutes, price FROM services WHERE salon_id = $1 AND is_active = TRUE ORDER BY price ASC`,
      [req.params.id],
    );
    res.json({
      salon: mapSalon(result.rows[0]),
      services: services.rows.map((service) => ({
        id: String(service.id),
        title: String(service.title),
        durationMinutes: Number(service.duration_minutes),
        price: Number(service.price),
      })),
    });
  } catch (error) {
    console.error(
      "Salon detail query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "Unable to load salon" });
  }
};
