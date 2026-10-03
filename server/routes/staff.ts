import type { RequestHandler } from "express";
import { databaseReady, pool } from "../db";

export const handleSalonStaff: RequestHandler = async (req, res) => {
  if (!pool) {
    res.status(503).json({ message: "DATABASE_URL is not configured" });
    return;
  }
  try {
    await databaseReady;
    const salon = await pool.query(
      `SELECT 1 FROM salons WHERE id = $1 AND is_active = TRUE AND approval_status = 'approved'`,
      [req.params.id],
    );
    if (!salon.rowCount) {
      res.status(404).json({ message: "سالن پیدا نشد" });
      return;
    }
    const serviceId =
      typeof req.query.serviceId === "string" ? req.query.serviceId : "";
    let staffFilter = "";
    if (serviceId) {
      const service = await pool.query(
        "SELECT 1 FROM services WHERE id = $1 AND salon_id = $2 AND is_active = TRUE",
        [serviceId, req.params.id],
      );
      if (!service.rowCount) {
        res.status(404).json({ message: "خدمت سالن پیدا نشد" });
        return;
      }
      const assignment = await pool.query(
        "SELECT EXISTS (SELECT 1 FROM service_staff WHERE service_id = $1) AS configured",
        [serviceId],
      );
      if (assignment.rows[0].configured)
        staffFilter =
          "AND EXISTS (SELECT 1 FROM service_staff ss WHERE ss.service_id = $2 AND ss.staff_id = staff.id)";
    }
    const result = await pool.query(
      `SELECT id, name, role_title, image
       FROM staff WHERE salon_id = $1 AND is_active = TRUE ${staffFilter} ORDER BY created_at ASC`,
      staffFilter ? [req.params.id, serviceId] : [req.params.id],
    );
    res.json({
      staff: result.rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        roleTitle: String(row.role_title),
        image: row.image ? String(row.image) : null,
      })),
    });
  } catch (error: unknown) {
    console.error(
      "Salon staff query failed:",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ message: "پرسنل سالن در دسترس نیستند" });
  }
};
