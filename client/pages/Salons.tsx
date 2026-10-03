import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SalonCard from "@/components/salon-card";
import { categories, cities } from "@/lib/salons-data";
import type { Salon } from "@/lib/salons-data";
import { cn } from "@/lib/utils";

const sortOptions = [
  { value: "popular", label: "محبوب‌ترین" },
  { value: "rating", label: "بیشترین امتیاز" },
  { value: "price-asc", label: "ارزان‌ترین" },
];

export default function Salons() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const selectedCity = searchParams.get("city") ?? "";
  const selectedCategories = searchParams.getAll("category");
  const minRating = Number(searchParams.get("minRating") ?? 0);
  const sort = searchParams.get("sort") ?? "popular";

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams(searchParams);
    if (query) params.set("q", query);
    else params.delete("q");

    setLoading(true);
    setError("");
    fetch(`/api/salons?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load salons");
        return (await response.json()) as { salons: Salon[] };
      })
      .then((data) => {
        if (active) setResults(data.salons);
      })
      .catch((reason: unknown) => {
        if (
          !active ||
          (reason instanceof DOMException && reason.name === "AbortError")
        )
          return;
        setError("دریافت اطلاعات سالن‌ها با مشکل مواجه شد. دوباره تلاش کنید.");
        setResults([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [searchParams, query]);

  const updateParams = (partial: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(partial).forEach(([key, value]) => {
      next.delete(key);
      if (value === null) return;
      if (Array.isArray(value)) value.forEach((item) => next.append(key, item));
      else if (value) next.set(key, value);
    });
    setSearchParams(next);
  };

  const toggleCategory = (category: string) => {
    const next = new Set(selectedCategories);
    next.has(category) ? next.delete(category) : next.add(category);
    updateParams({ category: Array.from(next) });
  };

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground md:text-3xl">
          جستجوی سالن و آرایشگاه
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          بین صدها سالن و آرایشگاه، بهترین گزینه رو پیدا کن
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجوی نام سالن یا خدمات..."
            className="h-11 pr-9"
          />
        </div>
        <Select
          value={selectedCity || "all"}
          onValueChange={(value) =>
            updateParams({ city: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="h-11 sm:w-44">
            <SelectValue placeholder="همه شهرها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه شهرها</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(value) =>
            updateParams({ sort: value === "popular" ? null : value })
          }
        >
          <SelectTrigger className="h-11 sm:w-44">
            <SelectValue placeholder="مرتب‌سازی" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="h-11 gap-2 sm:hidden"
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          فیلترها
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <aside
          className={cn(
            "space-y-6 rounded-2xl border border-border bg-card p-5 md:block",
            filtersOpen ? "block" : "hidden",
          )}
        >
          <div>
            <h3 className="mb-3 text-sm font-bold text-foreground">
              نوع خدمات
            </h3>
            <div className="space-y-2.5">
              {categories.map((category) => (
                <label
                  key={category}
                  className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
                >
                  <Checkbox
                    checked={selectedCategories.includes(category)}
                    onCheckedChange={() => toggleCategory(category)}
                  />
                  {category}
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold text-foreground">امتیاز</h3>
            <div className="space-y-2.5">
              {[4.5, 4, 3.5].map((rating) => (
                <label
                  key={rating}
                  className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
                >
                  <Checkbox
                    checked={minRating === rating}
                    onCheckedChange={(checked) =>
                      updateParams({
                        minRating: checked ? String(rating) : null,
                      })
                    }
                  />
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />
                    {rating} به بالا
                  </span>
                </label>
              ))}
            </div>
          </div>
          {(selectedCategories.length > 0 || selectedCity || minRating > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              پاک کردن فیلترها
            </Button>
          )}
        </aside>

        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            {loading
              ? "در حال دریافت سالن‌ها..."
              : `${results.length} سالن یافت شد`}
          </p>
          {error ? (
            <div className="rounded-2xl border border-dashed border-destructive/40 p-12 text-center text-sm text-destructive">
              {error}
            </div>
          ) : results.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((salon) => (
                <SalonCard key={salon.id} salon={salon} />
              ))}
            </div>
          ) : !loading ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              سالنی با این فیلترها یافت نشد. فیلترها رو تغییر بده و دوباره
              امتحان کن.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
