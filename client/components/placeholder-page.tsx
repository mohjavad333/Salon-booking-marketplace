import { Link } from "react-router-dom";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center gap-5 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Construction className="h-8 w-8" />
      </span>
      <h1 className="text-2xl font-extrabold text-foreground md:text-3xl">
        {title}
      </h1>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        {description ??
          "این صفحه هنوز ساخته نشده. برای تکمیل این بخش، در گفتگو توضیح بده چه چیزی داخل این صفحه می‌خوای تا برات بسازیمش."}
      </p>
      <Button asChild>
        <Link to="/">بازگشت به خانه</Link>
      </Button>
    </div>
  );
}
