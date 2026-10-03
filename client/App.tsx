import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Layout from "@/components/layout/Layout";
import PlaceholderPage from "@/components/placeholder-page";
import Index from "./pages/Index";
import Salons from "./pages/Salons";
import SalonProfile from "./pages/SalonProfile";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import Staff from "./pages/Staff";
import StaffSchedule from "./pages/StaffSchedule";
import OwnerReports from "./pages/OwnerReports";
import SalonSettings from "./pages/SalonSettings";
import MyBookings from "./pages/MyBookings";
import AdminDashboard from "./pages/AdminDashboard";
import Notifications from "./pages/Notifications";
import PaymentResult from "./pages/PaymentResult";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "@/lib/auth-context";

const queryClient = new QueryClient();

function ProtectedRoute({
  salonOnly = false,
  customerOnly = false,
  adminOnly = false,
  children,
}: {
  salonOnly?: boolean;
  customerOnly?: boolean;
  adminOnly?: boolean;
  children: JSX.Element;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        در حال بررسی حساب کاربری...
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  if (salonOnly && user.role !== "salon") {
    return <Navigate to="/salons" replace />;
  }
  if (customerOnly && user.role !== "customer") {
    return <Navigate to="/dashboard" replace />;
  }
  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/salons" element={<Salons />} />
              <Route path="/salons/:id" element={<SalonProfile />} />
              <Route path="/payment/result" element={<PaymentResult />} />
              <Route
                path="/for-business"
                element={
                  <PlaceholderPage
                    title="ثبت‌نام سالن در نوبتو"
                    description="فرم ثبت‌نام آرایشگاه‌ها و سالن‌های زیبایی و معرفی امکانات پنل مدیریت این‌جا قرار می‌گیره."
                  />
                }
              />
              <Route path="/login" element={<Auth />} />
              <Route path="/register" element={<Auth />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute salonOnly>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/schedule"
                element={
                  <ProtectedRoute salonOnly>
                    <Schedule />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/staff"
                element={
                  <ProtectedRoute salonOnly>
                    <Staff />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/staff/:staffId/schedule"
                element={
                  <ProtectedRoute salonOnly>
                    <StaffSchedule />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/reports"
                element={
                  <ProtectedRoute salonOnly>
                    <OwnerReports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/settings"
                element={
                  <ProtectedRoute salonOnly>
                    <SalonSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bookings"
                element={
                  <ProtectedRoute customerOnly>
                    <MyBookings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/account"
                element={
                  <ProtectedRoute customerOnly>
                    <MyBookings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/about"
                element={<PlaceholderPage title="درباره نوبتو" />}
              />
              <Route
                path="/contact"
                element={<PlaceholderPage title="تماس با ما" />}
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
