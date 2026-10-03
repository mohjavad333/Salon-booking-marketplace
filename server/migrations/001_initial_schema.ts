import type { PoolClient } from "pg";

export const version = "001";
export const name = "initial_schema";

export async function up(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('customer', 'salon', 'admin')),
      salon_name TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'salon', 'admin'));
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

    CREATE TABLE IF NOT EXISTS salons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      area TEXT NOT NULL,
      category TEXT NOT NULL,
      rating NUMERIC(2,1) NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      starting_price INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT,
      instagram TEXT,
      gallery_images TEXT[] NOT NULL DEFAULT '{}',
      tags TEXT[] NOT NULL DEFAULT '{}',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      approval_status TEXT NOT NULL DEFAULT 'approved',
      cancellation_window_hours INTEGER NOT NULL DEFAULT 24,
      cancellation_policy TEXT NOT NULL DEFAULT 'لغو رایگان تا ۲۴ ساعت قبل از نوبت',
      deposit_type TEXT NOT NULL DEFAULT 'none',
      deposit_value INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price INTEGER NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      phone TEXT,
      image TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (salon_id, name)
    );

    CREATE INDEX IF NOT EXISTS staff_salon_idx ON staff(salon_id, is_active);

    CREATE TABLE IF NOT EXISTS service_staff (
      service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (service_id, staff_id)
    );

    CREATE INDEX IF NOT EXISTS service_staff_staff_idx ON service_staff(staff_id, service_id);

    CREATE TABLE IF NOT EXISTS availability (
      id BIGSERIAL PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (salon_id, day_of_week, start_time)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id BIGSERIAL PRIMARY KEY,
      customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      service_id TEXT NOT NULL REFERENCES services(id),
      staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
      customer_phone TEXT NOT NULL,
      appointment_date DATE NOT NULL,
      appointment_time TIME NOT NULL,
      total_amount INTEGER NOT NULL DEFAULT 0,
      deposit_amount INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE salons ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE salons ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';
    ALTER TABLE salons ADD COLUMN IF NOT EXISTS cancellation_window_hours INTEGER NOT NULL DEFAULT 24;
    ALTER TABLE salons ADD COLUMN IF NOT EXISTS cancellation_policy TEXT NOT NULL DEFAULT 'لغو رایگان تا ۲۴ ساعت قبل از نوبت';
    ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE salons ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE salons ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
    ALTER TABLE salons ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE salons ADD COLUMN IF NOT EXISTS instagram TEXT;
    ALTER TABLE salons ADD COLUMN IF NOT EXISTS gallery_images TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE salons ADD COLUMN IF NOT EXISTS deposit_type TEXT NOT NULL DEFAULT 'none';
    ALTER TABLE salons ADD COLUMN IF NOT EXISTS deposit_value INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_approval_status_check;
    ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_deposit_type_check;
    ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_deposit_value_check;
    ALTER TABLE salons ADD CONSTRAINT salons_deposit_type_check CHECK (deposit_type IN ('none', 'fixed', 'percentage'));
    ALTER TABLE salons ADD CONSTRAINT salons_deposit_value_check CHECK (deposit_value >= 0);
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
    ALTER TABLE salons ADD CONSTRAINT salons_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    ALTER TABLE users ADD COLUMN IF NOT EXISTS salon_id TEXT REFERENCES salons(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS salons_city_idx ON salons(city);
    CREATE INDEX IF NOT EXISTS salons_category_idx ON salons(category);
    CREATE INDEX IF NOT EXISTS bookings_date_idx ON bookings(appointment_date);
    CREATE INDEX IF NOT EXISTS bookings_customer_idx ON bookings(customer_id);
    CREATE INDEX IF NOT EXISTS bookings_payment_status_idx ON bookings(payment_status, created_at DESC);
    CREATE INDEX IF NOT EXISTS users_salon_idx ON users(salon_id);

    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL;
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_salon_id_appointment_date_appointment_time_key;
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_staff_slot_idx
      ON bookings(salon_id, appointment_date, appointment_time, staff_id)
      WHERE staff_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_unassigned_slot_idx
      ON bookings(salon_id, appointment_date, appointment_time)
      WHERE staff_id IS NULL;

    CREATE TABLE IF NOT EXISTS reviews (
      id BIGSERIAL PRIMARY KEY,
      booking_id BIGINT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS favorites (
      customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (customer_id, salon_id)
    );

    CREATE INDEX IF NOT EXISTS reviews_salon_idx ON reviews(salon_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS favorites_salon_idx ON favorites(salon_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      booking_id BIGINT REFERENCES bookings(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, booking_id, type)
    );

    CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, is_read, created_at DESC);

    CREATE TABLE IF NOT EXISTS staff_availability (
      id BIGSERIAL PRIMARY KEY,
      staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (staff_id, day_of_week, start_time)
    );

    CREATE INDEX IF NOT EXISTS staff_availability_idx ON staff_availability(staff_id, day_of_week, start_time);

    CREATE TABLE IF NOT EXISTS availability_exceptions (
      id BIGSERIAL PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      exception_date DATE NOT NULL,
      is_closed BOOLEAN NOT NULL DEFAULT FALSE,
      start_time TIME,
      end_time TIME,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      CHECK (is_closed OR (start_time IS NOT NULL AND end_time IS NOT NULL)),
      CHECK (start_time IS NULL OR start_time < end_time)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS availability_exception_slot_idx
      ON availability_exceptions(salon_id, exception_date, start_time)
      WHERE start_time IS NOT NULL;
    CREATE INDEX IF NOT EXISTS availability_exception_date_idx
      ON availability_exceptions(salon_id, exception_date);

    CREATE TABLE IF NOT EXISTS staff_availability_exceptions (
      id BIGSERIAL PRIMARY KEY,
      staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      exception_date DATE NOT NULL,
      is_closed BOOLEAN NOT NULL DEFAULT FALSE,
      start_time TIME,
      end_time TIME,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      CHECK (is_closed OR (start_time IS NOT NULL AND end_time IS NOT NULL)),
      CHECK (start_time IS NULL OR start_time < end_time)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS staff_availability_exception_slot_idx
      ON staff_availability_exceptions(staff_id, exception_date, start_time)
      WHERE start_time IS NOT NULL;
    CREATE INDEX IF NOT EXISTS staff_availability_exception_date_idx
      ON staff_availability_exceptions(staff_id, exception_date);

    CREATE TABLE IF NOT EXISTS payments (
      id BIGSERIAL PRIMARY KEY,
      booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_transaction_id TEXT,
      provider_reference_id TEXT,
      amount INTEGER NOT NULL CHECK (amount > 0),
      payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'full', 'refund')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference_id TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_transaction_idx
      ON payments(provider, provider_transaction_id)
      WHERE provider_transaction_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS payments_pending_booking_idx
      ON payments(booking_id)
      WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments(booking_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
