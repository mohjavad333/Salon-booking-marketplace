import { Link } from "react-router-dom";
import { MapPin, Star } from "lucide-react";
import type { Salon } from "@/lib/salons-data";

function formatPrice(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

export default function SalonCard({ salon }: { salon: Salon }) {
  return (
    <Link
      to={`/salons/${salon.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={salon.image}
          alt={salon.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute right-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-sm">
          {salon.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-foreground">
            {salon.name}
          </h3>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-gold-50 px-2 py-1 text-xs font-bold text-gold-700">
            <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />
            {salon.rating}
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            {salon.city}، {salon.area}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {salon.reviewCount} نظر
          </span>
          <span className="text-sm font-bold text-primary">
            از {formatPrice(salon.startingPrice)} تومان
          </span>
        </div>
      </div>
    </Link>
  );
}
