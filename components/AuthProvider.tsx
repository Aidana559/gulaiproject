"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { clearChatSession, refreshChatSession } from "@/lib/chatStore";

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
  updateProfile: (patch: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);
const extraKey = (u: User) => `profile-extra:${u.id ?? u.email}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [serverUser, setServerUser] = useState<User | null>(null);
  const [extra, setExtra] = useState<Partial<User>>({});
  const [loading, setLoading] = useState(true);
  const lastRefreshAt = useRef(0);

  const refresh = useCallback(async () => {
    lastRefreshAt.current = Date.now();
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = res.ok ? await res.json() : null;
      
      void refreshChatSession(data?.user ?? null);
      const u: User | null = data?.user ?? data;
      if (u && u.email) {
        
        setServerUser((prev) => (prev && JSON.stringify(prev) === JSON.stringify(u) ? prev : u));
        try {
          const old = JSON.parse(localStorage.getItem(extraKey(u)) ?? "{}");
          const next: Partial<User> = {};
          if (u.bio === undefined && typeof old.bio === "string") next.bio = old.bio;
          if (u.telegram === undefined && typeof old.telegram === "string") next.telegram = old.telegram;
          if (u.avatar === undefined && typeof old.avatar === "string") next.avatar = old.avatar;
          setExtra(next);
        } catch {
          setExtra({});
        }
      } else {
        setServerUser(null);
        setExtra({});
      }
    } catch {
      void refreshChatSession(null);
      setServerUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  
  
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastRefreshAt.current < 60_000) return;
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    clearChatSession();
    setServerUser(null);
    setExtra({});
    router.push("/");
    router.refresh();
  }, [router]);

  const updateProfile = useCallback(
    async (patch: Partial<User>) => {
      if (!serverUser) throw new Error("Нужна авторизация");
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: patch.name, email: patch.email, bio: patch.bio, telegram: patch.telegram, avatar: patch.avatar }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.user) throw new Error(data?.error ?? "Не удалось сохранить профиль");
      setServerUser(data.user);
      setExtra({});
      void refreshChatSession(data.user);
    },
    [serverUser]
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