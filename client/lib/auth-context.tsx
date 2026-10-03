import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export interface CurrentUser {
  id: string;
  phone: string;
  role: "customer" | "salon" | "admin";
  salonName: string | null;
  salonId: string | null;
  createdAt: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  setAuthenticatedUser: (user: CurrentUser) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const authRequestId = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++authRequestId.current;
    try {
      const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      if (requestId !== authRequestId.current) return;
      if (!response.ok) {
        setUser(null);
        return;
      }
      const data = (await response.json()) as { user: CurrentUser | null };
      if (requestId === authRequestId.current) setUser(data.user);
    } catch {
      if (requestId === authRequestId.current) setUser(null);
    } finally {
      if (requestId === authRequestId.current) setLoading(false);
    }
  }, []);

  const setAuthenticatedUser = useCallback((authenticatedUser: CurrentUser) => {
    authRequestId.current += 1;
    setUser(authenticatedUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    authRequestId.current += 1;
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      setAuthenticatedUser,
      refresh,
      logout,
    }),
    [loading, logout, refresh, setAuthenticatedUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
