import type { Request, Response } from "express";
import { getUserFromRequest, type AuthUser } from "../auth";
import { pool } from "../db";

export async function requireUser(
  req: Request,
  res: Response,
  message: string,
): Promise<AuthUser | null> {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ message });
    return null;
  }
  return user;
}

export async function requireCustomer(
  req: Request,
  res: Response,
  unauthenticatedMessage: string,
  forbiddenMessage: string,
): Promise<AuthUser | null> {
  const user = await requireUser(req, res, unauthenticatedMessage);
  if (!user) return null;
  if (user.role !== "customer") {
    res.status(403).json({ message: forbiddenMessage });
    return null;
  }
  return user;
}

export async function requireAdmin(
  req: Request,
  res: Response,
  message: string,
  forbiddenMessage = "دسترسی به این عملیات مجاز نیست",
): Promise<AuthUser | null> {
  const user = await requireUser(req, res, message);
  if (!user) return null;
  if (user.role !== "admin") {
    res.status(403).json({ message: forbiddenMessage });
    return null;
  }
  return user;
}

export async function requireOwnerSalon(
  req: Request,
  res: Response,
): Promise<{ user: AuthUser; salonId: string } | null> {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ message: "برای مدیریت سالن وارد حساب کاربری شوید" });
    return null;
  }
  if (user.role !== "salon") {
    res.status(403).json({ message: "این بخش فقط برای صاحبان سالن است" });
    return null;
  }
  if (user.salonId) return { user, salonId: user.salonId };
  if (!pool || !user.salonName) {
    res.status(404).json({ message: "سالن متصل به این حساب پیدا نشد" });
    return null;
  }
  const result = await pool.query("SELECT id FROM salons WHERE name = $1", [
    user.salonName,
  ]);
  if (result.rowCount !== 1) {
    res.status(404).json({
      message: result.rowCount
        ? "چند سالن با این نام پیدا شد؛ اتصال سالن نیاز به بررسی مدیر دارد"
        : "سالن متصل به این حساب پیدا نشد",
    });
    return null;
  }
  const salonId = String(result.rows[0].id);
  await pool.query(
    "UPDATE users SET salon_id = $1 WHERE id = $2 AND salon_id IS NULL",
    [salonId, user.id],
  );
  return { user, salonId };
}
