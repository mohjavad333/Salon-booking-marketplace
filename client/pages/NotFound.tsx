import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-7xl font-black text-primary/20">۴۰۴</p>
      <h1 className="text-2xl font-extrabold text-foreground">
        صفحه پیدا نشد
      </h1>
      <p className="text-sm text-muted-foreground">
        آدرس واردشده وجود نداره یا جابه‌جا شده.
      </p>
      <Button asChild className="mt-2">
        <Link to="/">بازگشت به خانه</Link>
      </Button>
    </div>
  );
};

export default NotFound;
