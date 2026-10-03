export interface Salon {
  id: string;
  name: string;
  city: string;
  area: string;
  category: string;
  rating: number;
  reviewCount: number;
  startingPrice: number;
  image: string;
  description?: string;
  address?: string;
  phone?: string | null;
  instagram?: string | null;
  galleryImages?: string[];
  tags: string[];
}

export const cities = ["تهران", "مشهد", "اصفهان", "شیراز", "کرج", "تبریز"];

export const categories = [
  "کوتاهی و اصلاح مو",
  "رنگ و مش",
  "میکاپ و آرایش عروس",
  "ناخن و پدیکور",
  "اصلاح صورت و ریش",
  "پوست و اسپا",
  "ابرو و میکروبلیدینگ",
];

export const salons: Salon[] = [
  {
    id: "1",
    name: "سالن زیبایی ویولا",
    city: "تهران",
    area: "ونک",
    category: "میکاپ و آرایش عروس",
    rating: 4.9,
    reviewCount: 312,
    startingPrice: 850000,
    image:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop",
    tags: ["آرایش عروس", "میکاپ مجلسی"],
  },
  {
    id: "2",
    name: "آرایشگاه مردانه رویال",
    city: "تهران",
    area: "سعادت‌آباد",
    category: "کوتاهی و اصلاح مو",
    rating: 4.8,
    reviewCount: 480,
    startingPrice: 320000,
    image:
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=800&auto=format&fit=crop",
    tags: ["فید کاتری", "اصلاح ریش"],
  },
  {
    id: "3",
    name: "سالن گیسو",
    city: "اصفهان",
    area: "چهارباغ",
    category: "رنگ و مش",
    rating: 4.7,
    reviewCount: 198,
    startingPrice: 650000,
    image:
      "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=800&auto=format&fit=crop",
    tags: ["بالیاژ", "رنگ مو"],
  },
  {
    id: "4",
    name: "استودیو ناخن لمیرا",
    city: "تهران",
    area: "تجریش",
    category: "ناخن و پدیکور",
    rating: 4.9,
    reviewCount: 267,
    startingPrice: 420000,
    image:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800&auto=format&fit=crop",
    tags: ["ژلیش", "طراحی ناخن"],
  },
  {
    id: "5",
    name: "آرایشگاه مردانه باربر شاپ",
    city: "مشهد",
    area: "احمدآباد",
    category: "اصلاح صورت و ریش",
    rating: 4.6,
    reviewCount: 154,
    startingPrice: 280000,
    image:
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800&auto=format&fit=crop",
    tags: ["اصلاح کلاسیک", "پیرایش"],
  },
  {
    id: "6",
    name: "کلینیک پوست و زیبایی درسا",
    city: "شیراز",
    area: "معالی‌آباد",
    category: "پوست و اسپا",
    rating: 4.8,
    reviewCount: 221,
    startingPrice: 990000,
    image:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=800&auto=format&fit=crop",
    tags: ["فیشیال", "لیزر"],
  },
  {
    id: "7",
    name: "سالن ابرو آرتمیس",
    city: "کرج",
    area: "گوهردشت",
    category: "ابرو و میکروبلیدینگ",
    rating: 4.7,
    reviewCount: 132,
    startingPrice: 380000,
    image:
      "https://images.unsplash.com/photo-1519699047748-de8e457a634e?q=80&w=800&auto=format&fit=crop",
    tags: ["میکروبلیدینگ", "کاشت ابرو"],
  },
  {
    id: "8",
    name: "سالن مو و زیبایی النا",
    city: "تبریز",
    area: "ولیعصر",
    category: "کوتاهی و اصلاح مو",
    rating: 4.5,
    reviewCount: 96,
    startingPrice: 300000,
    image:
      "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?q=80&w=800&auto=format&fit=crop",
    tags: ["کوتاهی زنانه", "میزان"],
  },
];
