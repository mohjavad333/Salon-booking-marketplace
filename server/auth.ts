import { promisify } from "node:util";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";
import { databaseReady, pool } from "./db";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "nobto_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type UserRole = "customer" | "salon" | "admin";

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  salonName: string | null;
  salonId: string | null;
  createdAt: string;
}

function normalizeDigits(value: unknown) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export function normalizePhone(value: unknown) {
  return normalizeDigits(value).trim();
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getSessionToken(req: Request) {
  const cookies = req.headers.cookie?.split(";") ?? [];
  const sessionCookie = cookies.find((cookie) => cookie.trim().startsWith(`${SESSION_COOKIE}=`));
  return sessionCookie?.trim().slice(SESSION_COOKIE.length + 1) ?? null;
}

function setSessionCookie(res: Response, token: string, maxAge = SESSION_MAX_AGE) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${maxAge}`,
  );
}

export function clearSessionCookie(res: Response) {
  setSessionCookie(res, "", 0);
}

function mapUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    phone: String(row.phone),
    role: row.role === "salon" ? "salon" : row.role === "admin" ? "admin" : "customer",
    salonName: row.salon_name ? String(row.salon_name) : null,
    salonId: row.salon_id ? String(row.salon_id) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function createSession(res: Response, userId: string) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
    [hashSessionToken(token), userId],
  );
  setSessionCookie(res, token);
}

export async function getUserFromRequest(req: Request): Promise<AuthUser | null> {
  if (!pool) return null;
  const token = getSessionToken(req);
  if (!token) return null;

  await databaseReady;
  const result = await pool.query(
    `SELECT u.id, u.phone, u.role, u.salon_name, u.salon_id, u.created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashSessionToken(token)],
  );
  return result.rowCount ? mapUser(result.rows[0]) : null;
}

export async function registerUser(
  phone: string,
  password: string,
  role: UserRole,
  salonName: string | null,
  res: Response,
) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;
  const passwordHash = await hashPassword(password);
  const userId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let salonId: string | null = null;
    if (role === "salon") {
      salonId = randomUUID();
      await client.query(
        `INSERT INTO salons (id, name, city, area, category, image, is_active, approval_status)
         VALUES ($1, $2, 'ثبت نشده', 'ثبت نشده', 'سالن زیبایی', $3, FALSE, 'pending')`,
        [salonId, salonName, "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop"],
      );
    }
    const result = await client.query(
      `INSERT INTO users (id, phone, password_hash, role, salon_name, salon_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, phone, role, salon_name, salon_id, created_at`,
      [userId, phone, passwordHash, role, salonName, salonId],
    );
    await client.query("COMMIT");
    await createSession(res, userId);
    return mapUser(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function loginUser(phone: string, password: string, res: Response, expectedRole?: UserRole) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;
  const result = await pool.query(
    `SELECT id, phone, password_hash, role, salon_name, salon_id, is_active, created_at
     FROM users WHERE phone = $1`,
    [phone],
  );
  if (
    !result.rowCount
    || result.rows[0].is_active === false
    || (expectedRole && result.rows[0].role !== expectedRole)
    || !(await verifyPassword(password, String(result.rows[0].password_hash)))
  ) {
    return null;
  }
  await createSession(res, String(result.rows[0].id));
  return mapUser(result.rows[0]);
}

export async function logoutUser(req: Request, res: Response) {
  if (pool) {
    const token = getSessionToken(req);
    if (token) {
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashSessionToken(token)]);
    }
  }
  clearSessionCookie(res);
}
