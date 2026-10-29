"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type User = {
  id?: string | number;
  name: string;
  email: string;
  role?: string;
  createdAt?: string;
  activeBookings?: number;
  telegram?: string;
  bio?: string;
  avatar?: string | null;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => void;
};

const AuthContext = createContext<AuthCtx | null>(null);
const extraKey = (u: User) => `profile-extra:${u.id ?? u.email}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [serverUser, setServerUser] = useState<User | null>(null);
  const [extra, setExtra] = useState<Partial<User>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = res.ok ? await res.json() : null;
      const u: User | null = data?.user ?? data;
      if (u && u.email) {
        setServerUser(u);
        try {
          setExtra(JSON.parse(localStorage.getItem(extraKey(u)) ?? "{}"));
        } catch {
          setExtra({});
        }
      } else {
        setServerUser(null);
        setExtra({});
      }
    } catch {
      setServerUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setServerUser(null);
    setExtra({});
    router.push("/");
    router.refresh();
  }, [router]);

  const updateProfile = useCallback(
    (patch: Partial<User>) => {
      if (!serverUser) return;
      const next = { ...extra, ...patch };
      // TODO: заменить на fetch("/api/profile", { method: "PATCH", ... })
      localStorage.setItem(extraKey(serverUser), JSON.stringify(next));
      setExtra(next);
    },
    [serverUser, extra]
  );

  const user = serverUser ? { ...serverUser, ...extra } : null;

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}