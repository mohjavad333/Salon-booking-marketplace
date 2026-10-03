import type { RequestHandler } from "express";
import { databaseReady, pool } from "../db";
import { requireOwnerSalon } from "../middleware/auth";
import { assignmentSchema } from "../validators/misc";

export const handleOwnerServiceStaff: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const result = await pool.query(
      `SELECT ss.service_id, ss.staff_id
       FROM service_staff ss
       JOIN services s ON s.id = ss.service_id
       WHERE s.salon_id = $1
       ORDER BY ss.service_id, ss.staff_id`,
      [owner.salonId],
    );
    const assignments: Record<string, string[]> = {};
    for (const row of result.rows) {
      const serviceId = String(row.service_id);
      assignments[serviceId] = [
        ...(assignments[serviceId] ?? []),
        String(row.staff_id),
      ];
    }
    res.json({ assignments });
  } catch (error: unknown) {
    console.error(
      "Owner service staff query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ارتباط خدمات و پرسنل در دسترس نیست" });
  }
};

export const handleOwnerUpdateServiceStaff: RequestHandler = async (
  req,
  res,
) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "فهرست پرسنل معتبر نیست" });
    return;
  }
  try {
    const owner = await requireOwnerSalon(req, res);
    if (!owner) return;
    await databaseReady;
    const service = await pool.query(
      "SELECT 1 FROM services WHERE id = $1 AND salon_id = $2",
      [req.params.serviceId, owner.salonId],
    );
    if (!service.rowCount) {
      res.status(404).json({ message: "خدمت این سالن پیدا نشد" });
      return;
    }

    const uniqueStaffIds = [...new Set(parsed.data.staffIds)];
    if (uniqueStaffIds.length > 0) {
      const staff = await pool.query(
        `SELECT id FROM staff
         WHERE salon_id = $1 AND is_active = TRUE AND id = ANY($2::text[])`,
        [owner.salonId, uniqueStaffIds],
      );
      if (staff.rowCount !== uniqueStaffIds.length) {
        res
          .status(400)
          .json({
            message: "یکی از پرسنل انتخاب‌شده فعال یا متعلق به این سالن نیست",
          });
        return;
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM service_staff WHERE service_id = $1", [
        req.params.serviceId,
      ]);
      for (const staffId of uniqueStaffIds) {
        await client.query(
          "INSERT INTO service_staff (service_id, staff_id) VALUES ($1, $2)",
          [req.params.serviceId, staffId],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    res.json({ serviceId: req.params.serviceId, staffIds: uniqueStaffIds });
  } catch (error: unknown) {
    console.error(
      "Owner service staff update failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "ذخیره پرسنل خدمت انجام نشد" });
  }
};
