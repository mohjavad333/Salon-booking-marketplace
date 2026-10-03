import type { Pool } from "pg";

const demoSalons = [
  [
    "1",
    "سالن زیبایی ویولا",
    "تهران",
    "ونک",
    "میکاپ و آرایش عروس",
    4.9,
    312,
    850000,
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop",
    ["آرایش عروس", "میکاپ مجلسی"],
  ],
  [
    "2",
    "آرایشگاه مردانه رویال",
    "تهران",
    "سعادت‌آباد",
    "کوتاهی و اصلاح مو",
    4.8,
    480,
    320000,
    "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=800&auto=format&fit=crop",
    ["فید کاتری", "اصلاح ریش"],
  ],
  [
    "3",
    "سالن گیسو",
    "اصفهان",
    "چهارباغ",
    "رنگ و مش",
    4.7,
    198,
    650000,
    "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=800&auto=format&fit=crop",
    ["بالیاژ", "رنگ مو"],
  ],
  [
    "4",
    "استودیو ناخن لمیرا",
    "تهران",
    "تجریش",
    "ناخن و پدیکور",
    4.9,
    267,
    420000,
    "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800&auto=format&fit=crop",
    ["ژلیش", "طراحی ناخن"],
  ],
  [
    "5",
    "آرایشگاه مردانه باربر شاپ",
    "مشهد",
    "احمدآباد",
    "اصلاح صورت و ریش",
    4.6,
    154,
    280000,
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800&auto=format&fit=crop",
    ["اصلاح کلاسیک", "پیرایش"],
  ],
  [
    "6",
    "کلینیک پوست و زیبایی درسا",
    "شیراز",
    "معالی‌آباد",
    "پوست و اسپا",
    4.8,
    221,
    990000,
    "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=800&auto=format&fit=crop",
    ["فیشیال", "لیزر"],
  ],
  [
    "7",
    "سالن ابرو آرتمیس",
    "کرج",
    "گوهردشت",
    "ابرو و میکروبلیدینگ",
    4.7,
    132,
    380000,
    "https://images.unsplash.com/photo-1519699047748-de8e457a634e?q=80&w=800&auto=format&fit=crop",
    ["میکروبلیدینگ", "کاشت ابرو"],
  ],
  [
    "8",
    "سالن مو و زیبایی النا",
    "تبریز",
    "ولیعصر",
    "کوتاهی و اصلاح مو",
    4.5,
    96,
    300000,
    "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?q=80&w=800&auto=format&fit=crop",
    ["کوتاهی زنانه", "میزان"],
  ],
] as const;

const demoServices = [
  ["service-1", "1", "میکاپ مجلسی", 90, 850000],
  ["service-2", "1", "آرایش عروس", 180, 2500000],
  ["service-3", "2", "کوتاهی و اصلاح", 60, 320000],
  ["service-4", "4", "ژلیش و طراحی ناخن", 90, 420000],
] as const;

export async function seedDevelopmentData(pool: Pool) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const salon of demoSalons) {
      await client.query(
        `INSERT INTO salons
          (id, name, city, area, category, rating, review_count, starting_price, image, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [...salon],
      );
    }

    for (const service of demoServices) {
      await client.query(
        `INSERT INTO services (id, salon_id, title, duration_minutes, price)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [...service],
      );
    }

    const defaultSlots = [
      ["09:00", "10:00"],
      ["10:30", "11:30"],
      ["12:00", "13:00"],
      ["13:30", "14:30"],
      ["15:00", "16:00"],
      ["16:30", "17:30"],
      ["18:00", "19:00"],
      ["19:30", "20:00"],
    ];

    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek += 1) {
      for (const [startTime, endTime] of defaultSlots) {
        await client.query(
          `INSERT INTO availability (salon_id, day_of_week, start_time, end_time)
           SELECT id, $1, $2, $3 FROM salons
           ON CONFLICT (salon_id, day_of_week, start_time) DO NOTHING`,
          [dayOfWeek, startTime, endTime],
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
