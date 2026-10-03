import type { RequestHandler } from "express";
import {
  getUserFromRequest,
  loginUser,
  logoutUser,
  registerUser,
} from "../auth";
import { pool } from "../db";
import { loginSchema, registerSchema } from "../validators/auth";

export const handleRegister: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  const parsed = registerSchema.safeParse(req.body);
  if (
    !parsed.success ||
    (parsed.data.role === "salon" && !parsed.data.salonName)
  ) {
    res.status(400).json({ message: "اطلاعات ثبت‌نام معتبر نیست" });
    return;
  }

  try {
    const user = await registerUser(
      parsed.data.phone,
      parsed.data.password,
      parsed.data.role,
      parsed.data.role === "salon" ? (parsed.data.salonName ?? null) : null,
      res,
    );
    res.status(201).json({ user });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ message: "این شماره موبایل قبلاً ثبت شده است" });
      return;
    }
    console.error(
      "User registration failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ثبت‌نام انجام نشد" });
  }
};

export const handleLogin: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "شماره موبایل یا رمز عبور معتبر نیست" });
    return;
  }

  try {
    const user = await loginUser(
      parsed.data.phone,
      parsed.data.password,
      res,
      parsed.data.role,
    );
    if (!user) {
      res.status(401).json({ message: "شماره موبایل یا رمز عبور اشتباه است" });
      return;
    }
    res.json({ user });
  } catch (error: unknown) {
    console.error(
      "User login failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ورود انجام نشد" });
  }
};

export const handleCurrentUser: RequestHandler = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = await getUserFromRequest(req);
    res.json({ user });
  } catch (error: unknown) {
    console.error(
      "Current user lookup failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "وضعیت ورود قابل دریافت نیست" });
  }
};

export const handleLogout: RequestHandler = async (req, res) => {
  try {
    await logoutUser(req, res);
    res.status(204).end();
  } catch (error: unknown) {
    console.error(
      "User logout failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "خروج انجام نشد" });
  }
};
