import { randomBytes, randomInt, randomUUID, scryptSync } from "node:crypto";
import type { Server } from "node:http";
import { createServer } from "./index";
import { databaseReady, pool } from "./db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const e2eSuite = describe.skipIf(!hasDatabase);

e2eSuite("marketplace core API flow", () => {
  const runId = randomInt(100000000, 999999999);
  const ownerPhone = `09${runId}`;
  const customerPhone = `09${randomInt(100000000, 999999999)}`;
  const adminPhone = `09${randomInt(100000000, 999999999)}`;
  const salonName = `E2E Salon ${runId}`;
  const password = "E2e-Password-9831";
  const userIds: string[] = [];
  const salonIds: string[] = [];
  let server: Server;
  let baseUrl: string;
  let ownerCookie = "";
  let customerCookie = "";
  let salonId = "";

  beforeAll(async () => {
    if (!pool) throw new Error("DATABASE_URL is not configured");
    await databaseReady;
    const app = createServer();
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not bind to a TCP port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 30_000);

  afterAll(async () => {
    try {
      if (pool && salonIds.length) {
        await pool.query("DELETE FROM salons WHERE id = ANY($1::text[])", [
          salonIds,
        ]);
      }
      if (pool && userIds.length) {
        await pool.query("DELETE FROM users WHERE id = ANY($1::text[])", [
          userIds,
        ]);
      }
    } finally {
      if (server?.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    }
  }, 30_000);

  it("registers accounts, configures a salon, books, reschedules and cancels", async () => {
    const anonymousBookings = await request("/api/bookings/me");
    expect(anonymousBookings.response.status).toBe(401);

    const ownerRegistration = await request("/api/auth/register", {
      method: "POST",
      body: {
        phone: ownerPhone,
        password,
        role: "salon",
        salonName,
      },
    });
    expect(ownerRegistration.response.status).toBe(201);
    expect(ownerRegistration.data.user.role).toBe("salon");
    ownerCookie = ownerRegistration.cookie;
    salonId = String(ownerRegistration.data.user.salonId);
    userIds.push(String(ownerRegistration.data.user.id));
    salonIds.push(salonId);

    const ownerSession = await request("/api/auth/me", {
      cookie: ownerCookie,
    });
    expect(ownerSession.data.user.id).toBe(ownerRegistration.data.user.id);

    const logout = await request("/api/auth/logout", {
      method: "POST",
      cookie: ownerCookie,
    });
    expect(logout.response.status).toBe(204);

    const ownerLogin = await request("/api/auth/login", {
      method: "POST",
      body: { phone: ownerPhone, password, role: "salon" },
    });
    expect(ownerLogin.response.status).toBe(200);
    ownerCookie = ownerLogin.cookie;

    await pool!.query(
      `UPDATE salons
       SET city = $1, area = 'آزمایش', category = 'تست E2E', is_active = TRUE,
           approval_status = 'approved', cancellation_window_hours = 0
       WHERE id = $2`,
      [`شهر-${runId}`, salonId],
    );

    const serviceResponse = await request("/api/owner/services", {
      method: "POST",
      cookie: ownerCookie,
      body: {
        title: `خدمت تست ${runId}`,
        durationMinutes: 60,
        price: 120000,
        isActive: true,
      },
    });
    expect(serviceResponse.response.status).toBe(201);
    const serviceId = String(serviceResponse.data.service.id);

    const staffResponse = await request("/api/owner/staff", {
      method: "POST",
      cookie: ownerCookie,
      body: { name: `پرسنل ${runId}`, roleTitle: "آرایشگر" },
    });
    expect(staffResponse.response.status).toBe(201);
    const staffId = String(staffResponse.data.staff.id);

    const assignment = await request(`/api/owner/services/${serviceId}/staff`, {
      method: "PUT",
      cookie: ownerCookie,
      body: { staffIds: [staffId] },
    });
    expect(assignment.response.status).toBe(200);

    const appointmentDate = dateAfterDays(8);
    const dayOfWeek =
      (new Date(`${appointmentDate}T00:00:00Z`).getUTCDay() + 1) % 7;
    const schedule = await request(`/api/owner/staff/${staffId}/availability`, {
      method: "PUT",
      cookie: ownerCookie,
      body: {
        dayOfWeek,
        slots: [{ startTime: "09:00", endTime: "12:00", isAvailable: true }],
      },
    });
    expect(schedule.response.status).toBe(200);

    const salonSearch = await request(
      `/api/salons?city=${encodeURIComponent(`شهر-${runId}`)}`,
    );
    expect(salonSearch.response.status).toBe(200);
    expect(
      salonSearch.data.salons.some(
        (salon: { id: string }) => salon.id === salonId,
      ),
    ).toBe(true);

    const salonDetails = await request(`/api/salons/${salonId}`);
    expect(salonDetails.response.status).toBe(200);
    expect(
      salonDetails.data.services.some(
        (service: { id: string }) => service.id === serviceId,
      ),
    ).toBe(true);

    const availability = await request(
      `/api/salons/${salonId}/availability?date=${appointmentDate}&serviceId=${serviceId}&staffId=${staffId}`,
    );
    expect(availability.response.status).toBe(200);
    expect(availability.data.availability).toContainEqual(
      expect.objectContaining({
        startTime: "10:00",
        isAvailable: true,
        isBooked: false,
      }),
    );

    const customerRegistration = await request("/api/auth/register", {
      method: "POST",
      body: { phone: customerPhone, password, role: "customer" },
    });
    expect(customerRegistration.response.status).toBe(201);
    expect(customerRegistration.data.user.role).toBe("customer");
    customerCookie = customerRegistration.cookie;
    userIds.push(String(customerRegistration.data.user.id));

    const duplicateRegistration = await request("/api/auth/register", {
      method: "POST",
      body: { phone: customerPhone, password, role: "customer" },
    });
    expect(duplicateRegistration.response.status).toBe(409);

    const invalidLogin = await request("/api/auth/login", {
      method: "POST",
      body: { phone: customerPhone, password: "wrong-password" },
    });
    expect(invalidLogin.response.status).toBe(401);

    const bookingResponse = await request("/api/bookings", {
      method: "POST",
      cookie: customerCookie,
      body: {
        salonId,
        serviceId,
        staffId,
        customerPhone,
        appointmentDate,
        appointmentTime: "10:00",
      },
    });
    expect(bookingResponse.response.status).toBe(201);
    expect(bookingResponse.data.booking.status).toBe("confirmed");
    expect(bookingResponse.data.booking.payment_status).toBe("not_required");
    const bookingId = String(bookingResponse.data.booking.id);

    const overlappingBooking = await request("/api/bookings", {
      method: "POST",
      cookie: customerCookie,
      body: {
        salonId,
        serviceId,
        staffId,
        customerPhone,
        appointmentDate,
        appointmentTime: "10:30",
      },
    });
    expect(overlappingBooking.response.status).toBe(400);

    const customerBookings = await request("/api/bookings/me", {
      cookie: customerCookie,
    });
    expect(customerBookings.response.status).toBe(200);
    expect(
      customerBookings.data.bookings.some(
        (booking: { id: string }) => booking.id === bookingId,
      ),
    ).toBe(true);

    const customerOwnerAccess = await request("/api/owner/overview", {
      cookie: customerCookie,
    });
    expect(customerOwnerAccess.response.status).toBe(403);

    const customerAdminAccess = await request("/api/admin/overview", {
      cookie: customerCookie,
    });
    expect(customerAdminAccess.response.status).toBe(403);

    const reschedule = await request(`/api/bookings/${bookingId}/reschedule`, {
      method: "POST",
      cookie: customerCookie,
      body: { appointmentDate, appointmentTime: "11:00" },
    });
    expect(reschedule.response.status).toBe(200);
    expect(String(reschedule.data.booking.appointment_time).slice(0, 5)).toBe(
      "11:00",
    );

    const ownerOverview = await request("/api/owner/overview", {
      cookie: ownerCookie,
    });
    expect(ownerOverview.response.status).toBe(200);
    expect(ownerOverview.data.salon.id).toBe(salonId);

    const cancel = await request(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      cookie: customerCookie,
    });
    expect(cancel.response.status).toBe(200);
    expect(cancel.data.booking.status).toBe("cancelled");

    const repeatedCancel = await request(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      cookie: customerCookie,
    });
    expect(repeatedCancel.response.status).toBe(404);

    const adminId = randomUUID();
    const salt = randomBytes(16).toString("hex");
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
    await pool!.query(
      `INSERT INTO users (id, phone, password_hash, role)
       VALUES ($1, $2, $3, 'admin')`,
      [adminId, adminPhone, passwordHash],
    );
    userIds.push(adminId);

    const adminLogin = await request("/api/auth/login", {
      method: "POST",
      body: { phone: adminPhone, password },
    });
    expect(adminLogin.response.status).toBe(200);
    expect(adminLogin.data.user.role).toBe("admin");

    const adminOverview = await request("/api/admin/overview", {
      cookie: adminLogin.cookie,
    });
    expect(adminOverview.response.status).toBe(200);

    const logoutCustomer = await request("/api/auth/logout", {
      method: "POST",
      cookie: customerCookie,
    });
    expect(logoutCustomer.response.status).toBe(204);
    const expiredSession = await request("/api/auth/me", {
      cookie: customerCookie,
    });
    expect(expiredSession.data.user).toBeNull();
  }, 60_000);

  async function request(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      cookie?: string;
    } = {},
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const raw = response.status === 204 ? "" : await response.text();
    const data = raw ? JSON.parse(raw) : {};
    const setCookie = response.headers.get("set-cookie") ?? "";
    return {
      response,
      data,
      cookie: setCookie.split(";")[0] ?? "",
    };
  }

  function dateAfterDays(days: number) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
});
