import type { RequestHandler } from "express";
import { requireAdmin } from "../middleware/auth";
import { databaseReady, pool } from "../db";
import {
  salonStatusSchema,
  salonUpdateSchema,
  userStatusSchema,
} from "../validators/admin";

export const handleAdminUserStatus: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = userStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "وضعیت کاربر معتبر نیست" });
    return;
  }
  try {
    const admin = await requireAdmin(
      req,
      res,
      "برای انجام این عملیات وارد حساب کاربری شوید",
    );
    if (!admin) return;
    if (req.params.id === admin.id) {
      res
        .status(400)
        .json({ message: "نمی‌توانید وضعیت حساب خودتان را تغییر دهید" });
      return;
    }
    await databaseReady;
    const result = await pool.query(
      `UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, is_active`,
      [parsed.data.isActive, req.params.id],
    );
    if (!result.rowCount) {
      res.status(404).json({ message: "کاربر پیدا نشد" });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch (error: unknown) {
    console.error(
      "Admin user status update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "تغییر وضعیت کاربر انجام نشد" });
  }
};

export const handleAdminSalonStatus: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = salonStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "وضعیت سالن معتبر نیست" });
    return;
  }
  try {
    const admin = await requireAdmin(
      req,
      res,
      "برای انجام این عملیات وارد حساب کاربری شوید",
    );
    if (!admin) return;
    await databaseReady;
    const result = await pool.query(
      `UPDATE salons
       SET approval_status = $1, is_active = COALESCE($2, is_active)
       WHERE id = $3
       RETURNING id, is_active, approval_status`,
      [parsed.data.approvalStatus, parsed.data.isActive ?? null, req.params.id],
    );
    if (!result.rowCount) {
      res.status(404).json({ message: "سالن پیدا نشد" });
      return;
    }
    res.json({ salon: result.rows[0] });
  } catch (error: unknown) {
    console.error(
      "Admin salon status update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "تغییر وضعیت سالن انجام نشد" });
  }
};

export const handleAdminSalonUpdate: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = salonUpdateSchema.safeParse({
    ...req.body,
    startingPrice:
      req.body?.startingPrice === undefined
        ? undefined
        : Number(req.body.startingPrice),
  });
  if (!parsed.success) {
    res.status(400).json({ message: "اطلاعات ویرایش سالن معتبر نیست" });
    return;
  }
  try {
    const admin = await requireAdmin(
      req,
      res,
      "برای انجام این عملیات وارد حساب کاربری شوید",
    );
    if (!admin) return;
    await databaseReady;
    const result = await pool.query(
      `UPDATE salons
       SET name = COALESCE($1, name), city = COALESCE($2, city),
           area = COALESCE($3, area), category = COALESCE($4, category),
           starting_price = COALESCE($5, starting_price)
       WHERE id = $6
       RETURNING id, name, city, area, category, starting_price, is_active, approval_status`,
      [
        parsed.data.name ?? null,
        parsed.data.city ?? null,
        parsed.data.area ?? null,
        parsed.data.category ?? null,
        parsed.data.startingPrice ?? null,
        req.params.id,
      ],
    );
    if (!result.rowCount) {
      res.status(404).json({ message: "سالن پیدا نشد" });
      return;
    }
    res.json({ salon: result.rows[0] });
  } catch (error: unknown) {
    console.error(
      "Admin salon update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ویرایش سالن انجام نشد" });
  }
};
