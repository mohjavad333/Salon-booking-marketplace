import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleDatabaseHealth } from "./routes/database";
import { handleSalonById, handleSalons } from "./routes/salons";
import { handleCreateBooking } from "./routes/bookings";
import {
  handleCurrentUser,
  handleLogin,
  handleLogout,
  handleRegister,
} from "./routes/auth";
import {
  handleCancelBooking,
  handleMyBookings,
  handleRescheduleBooking,
} from "./routes/customer-bookings";
import {
  handleAdminBookingStatus,
  handleAdminBookings,
  handleAdminOverview,
  handleAdminSalons,
  handleAdminUsers,
} from "./routes/admin";
import {
  handleAdminSalonStatus,
  handleAdminSalonUpdate,
  handleAdminUserStatus,
} from "./routes/admin-actions";
import {
  handleOwnerBookingStaff,
  handleOwnerBookingStatus,
  handleOwnerCreateService,
  handleOwnerDeleteService,
  handleOwnerOverview,
  handleOwnerUpdateSalon,
  handleOwnerUpdateSalonStatus,
  handleOwnerUpdateService,
} from "./routes/owner";
import {
  handleOwnerAvailability,
  handleOwnerSaveAvailability,
} from "./routes/owner-availability";
import {
  handleOwnerAvailabilityExceptions,
  handleOwnerSaveAvailabilityException,
} from "./routes/owner-availability-exceptions";
import { handleOwnerReports } from "./routes/owner-reports";
import {
  handleOwnerSettings,
  handleOwnerUpdateSettings,
} from "./routes/owner-settings";
import { handleSalonAvailability } from "./routes/availability";
import { handleSalonStaff } from "./routes/staff";
import {
  handleOwnerStaffAvailability,
  handleOwnerSaveStaffAvailability,
} from "./routes/owner-staff-availability";
import {
  handleOwnerStaffAvailabilityExceptions,
  handleOwnerSaveStaffAvailabilityException,
} from "./routes/owner-staff-availability-exceptions";
import {
  handleMarkAllNotificationsRead,
  handleMarkNotificationRead,
  handleNotificationPreferences,
  handleNotifications,
  handleUpdateNotificationPreferences,
} from "./routes/notifications";
import { handleCreateReview, handleSalonReviews } from "./routes/reviews";
import {
  handleOwnerCreateStaff,
  handleOwnerDeleteStaff,
  handleOwnerStaff,
  handleOwnerUpdateStaff,
} from "./routes/owner-staff";
import {
  handleOwnerServiceStaff,
  handleOwnerUpdateServiceStaff,
} from "./routes/owner-service-staff";
import { handleOwnerCalendar } from "./routes/owner-calendar";
import {
  handleAddFavorite,
  handleFavoriteStatus,
  handleMyFavorites,
  handleRemoveFavorite,
} from "./routes/favorites";
import { handlePaymentCallback, handleStartPayment } from "./routes/payments";
import { handleRefundPayment } from "./routes/payment-refunds";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/health/database", handleDatabaseHealth);
  app.get("/api/salons", handleSalons);
  app.get("/api/salons/:id", handleSalonById);
  app.get("/api/salons/:id/availability", handleSalonAvailability);
  app.get("/api/salons/:id/staff", handleSalonStaff);
  app.get("/api/salons/:id/reviews", handleSalonReviews);
  app.post("/api/salons/:id/reviews", handleCreateReview);
  app.post("/api/bookings", handleCreateBooking);
  app.post("/api/payments/start", handleStartPayment);
  app.get("/api/payments/callback", handlePaymentCallback);
  app.post("/api/payments/bookings/:bookingId/refund", handleRefundPayment);
  app.post("/api/auth/register", handleRegister);
  app.post("/api/auth/login", handleLogin);
  app.get("/api/auth/me", handleCurrentUser);
  app.post("/api/auth/logout", handleLogout);
  app.get("/api/bookings/me", handleMyBookings);
  app.post("/api/bookings/:id/cancel", handleCancelBooking);
  app.post("/api/bookings/:id/reschedule", handleRescheduleBooking);
  app.get("/api/notifications", handleNotifications);
  app.patch("/api/notifications/:id/read", handleMarkNotificationRead);
  app.post("/api/notifications/read-all", handleMarkAllNotificationsRead);
  app.get("/api/notifications/preferences", handleNotificationPreferences);
  app.patch(
    "/api/notifications/preferences",
    handleUpdateNotificationPreferences,
  );
  app.get("/api/favorites", handleMyFavorites);
  app.get("/api/favorites/:salonId", handleFavoriteStatus);
  app.put("/api/favorites/:salonId", handleAddFavorite);
  app.delete("/api/favorites/:salonId", handleRemoveFavorite);
  app.get("/api/admin/overview", handleAdminOverview);
  app.get("/api/admin/users", handleAdminUsers);
  app.get("/api/admin/salons", handleAdminSalons);
  app.get("/api/admin/bookings", handleAdminBookings);
  app.patch("/api/admin/bookings/:id/status", handleAdminBookingStatus);
  app.patch("/api/admin/users/:id/status", handleAdminUserStatus);
  app.patch("/api/admin/salons/:id/status", handleAdminSalonStatus);
  app.patch("/api/admin/salons/:id", handleAdminSalonUpdate);
  app.get("/api/owner/overview", handleOwnerOverview);
  app.get("/api/owner/calendar", handleOwnerCalendar);
  app.patch("/api/owner/bookings/:id/status", handleOwnerBookingStatus);
  app.patch("/api/owner/bookings/:id/staff", handleOwnerBookingStaff);
  app.post("/api/owner/services", handleOwnerCreateService);
  app.patch("/api/owner/services/:id", handleOwnerUpdateService);
  app.delete("/api/owner/services/:id", handleOwnerDeleteService);
  app.patch("/api/owner/salon", handleOwnerUpdateSalon);
  app.patch("/api/owner/salon/status", handleOwnerUpdateSalonStatus);
  app.get("/api/owner/availability", handleOwnerAvailability);
  app.put("/api/owner/availability", handleOwnerSaveAvailability);
  app.get(
    "/api/owner/availability/exceptions",
    handleOwnerAvailabilityExceptions,
  );
  app.put(
    "/api/owner/availability/exceptions",
    handleOwnerSaveAvailabilityException,
  );
  app.get("/api/owner/reports", handleOwnerReports);
  app.get("/api/owner/settings", handleOwnerSettings);
  app.patch("/api/owner/settings", handleOwnerUpdateSettings);
  app.get("/api/owner/staff", handleOwnerStaff);
  app.post("/api/owner/staff", handleOwnerCreateStaff);
  app.patch("/api/owner/staff/:id", handleOwnerUpdateStaff);
  app.delete("/api/owner/staff/:id", handleOwnerDeleteStaff);
  app.get(
    "/api/owner/staff/:staffId/availability",
    handleOwnerStaffAvailability,
  );
  app.put(
    "/api/owner/staff/:staffId/availability",
    handleOwnerSaveStaffAvailability,
  );
  app.get(
    "/api/owner/staff/:staffId/availability/exceptions",
    handleOwnerStaffAvailabilityExceptions,
  );
  app.put(
    "/api/owner/staff/:staffId/availability/exceptions",
    handleOwnerSaveStaffAvailabilityException,
  );
  app.get("/api/owner/service-staff", handleOwnerServiceStaff);
  app.put(
    "/api/owner/services/:serviceId/staff",
    handleOwnerUpdateServiceStaff,
  );

  return app;
}
