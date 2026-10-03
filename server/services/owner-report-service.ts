import { databaseReady, pool } from "../db";
import { findOwnerReportData } from "../repositories/owner-report-repository";

export async function getOwnerReport(salonId: string, days: number) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await databaseReady;
  const data = await findOwnerReportData(pool, salonId, days);
  const row = data.summary;

  return {
    rangeDays: days,
    summary: {
      totalBookings: Number(row.total_bookings),
      confirmedBookings: Number(row.confirmed_bookings),
      completedBookings: Number(row.completed_bookings),
      cancelledBookings: Number(row.cancelled_bookings),
      noShowBookings: Number(row.no_show_bookings),
      grossRevenue: Number(row.gross_revenue),
      averageTicket: Number(row.average_ticket),
      uniqueCustomers: Number(row.unique_customers),
      depositExpected: Number(row.deposit_expected),
      paidAmount: Number(row.paid_amount),
      pendingAmount: Number(row.pending_amount),
      refundedAmount: Number(row.refunded_amount),
      netPaidAmount: Number(row.paid_amount) - Number(row.refunded_amount),
      paymentCount: Number(row.payment_count),
    },
    services: data.services.map((item) => ({
      title: String(item.title),
      bookings: Number(item.bookings),
      revenue: Number(item.revenue),
    })),
    staff: data.staff.map((item) => ({
      name: String(item.name),
      bookings: Number(item.bookings),
      completedBookings: Number(item.completed_bookings),
      revenue: Number(item.revenue),
    })),
    daily: data.daily.map((item) => ({
      date: String(item.date),
      bookings: Number(item.bookings),
      revenue: Number(item.revenue),
      depositExpected: Number(item.deposit_expected),
    })),
    transactions: data.transactions.map((item) => ({
      id: String(item.id),
      bookingId: String(item.booking_id),
      provider: String(item.provider),
      amount: Number(item.amount),
      paymentType: String(item.payment_type),
      status: String(item.status),
      customerPhone: String(item.customer_phone),
      serviceTitle: String(item.service_title),
      createdAt: new Date(String(item.created_at)).toISOString(),
    })),
  };
}
