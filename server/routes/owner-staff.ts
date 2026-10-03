import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { databaseReady, pool } from "../db";
import { requireOwnerSalon } from "../middleware/auth";
import { staffSchema, staffUpdateSchema } from "../validators/staff";

function mapStaff(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    roleTitle: String(row.role_title),
    phone: row.phone ? String(row.phone) : null,
    image: row.image ? String(row.image) : null,
    isActive: row.is_active !== false,
  };
}

export const handleOwnerStaff: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      `SELECT id, name, role_title, phone, image, is_active
       FROM staff WHERE salon_id = $1 ORDER BY is_active DESC, created_at DESC`,
      [owner.salonId],
    );
    res.json({ staff: result.rows.map(mapStaff) });
  } catch (error: unknown) {
    console.error(
      "Owner staff query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "فهرست پرسنل در دسترس نیست" });
  }
};

export const handleOwnerCreateStaff: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = staffSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "اطلاعات پرسنل معتبر نیست" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      `INSERT INTO staff (id, salon_id, name, role_title, phone, image, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, role_title, phone, image, is_active`,
      [
        randomUUID(),
        owner.salonId,
        parsed.data.name,
        parsed.data.roleTitle,
        parsed.data.phone ?? null,
        parsed.data.image ?? null,
        parsed.data.isActive ?? true,
      ],
    );
    res.status(201).json({ staff: mapStaff(result.rows[0]) });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ message: "پرسنلی با این نام قبلاً ثبت شده است" });
      return;
    }
    console.error(
      "Owner staff creation failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "افزودن پرسنل انجام نشد" });
  }
};

export const handleOwnerUpdateStaff: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = staffUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "اطلاعات ویرایش پرسنل معتبر نیست" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      `UPDATE staff SET name = COALESCE($1, name), role_title = COALESCE($2, role_title),
       phone = COALESCE($3, phone), image = COALESCE($4, image), is_active = COALESCE($5, is_active)
       WHERE id = $6 AND salon_id = $7
       RETURNING id, name, role_title, phone, image, is_active`,
      [
        parsed.data.name ?? null,
        parsed.data.roleTitle ?? null,
        parsed.data.phone ?? null,
        parsed.data.image ?? null,
        parsed.data.isActive ?? null,
        req.params.id,
        owner.salonId,
      ],
    );
    if (!result.rowCount) {
      res.status(404).json({ message: "پرسنل این سالن پیدا نشد" });
      return;
    }
    res.json({ staff: mapStaff(result.rows[0]) });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ message: "پرسنلی با این نام قبلاً ثبت شده است" });
      return;
    }
    console.error(
      "Owner staff update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ویرایش پرسنل انجام نشد" });
  }
};

export const handleOwnerDeleteStaff: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      "DELETE FROM staff WHERE id = $1 AND salon_id = $2 RETURNING id",
      [req.params.id, owner.salonId],
    );
    if (!result.rowCount) {
      res.status(404).json({ message: "پرسنل این سالن پیدا نشد" });
      return;
    }
    res.status(204).end();
  } catch (error: unknown) {
    console.error(
      "Owner staff deletion failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "حذف پرسنل انجام نشد" });
  }
};
