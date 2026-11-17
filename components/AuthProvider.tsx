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
  updateProfile: (patch: Partial<User>) => void;
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
      // чаты получают этот же ответ: отдельный второй запрос /api/auth/me больше не нужен
      void refreshChatSession(data?.user ?? null);
      const u: User | null = data?.user ?? data;
      if (u && u.email) {
        // тот же пользователь — сохраняем прежний объект, чтобы не перерисовывать весь сайт и не перезапускать эффекты
        setServerUser((prev) => (prev && JSON.stringify(prev) === JSON.stringify(u) ? prev : u));
        try {
          const next = JSON.parse(localStorage.getItem(extraKey(u)) ?? "{}");
          setExtra((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
          // бұрын тек браузерде сақталған атты (мысалы «astan») бір рет серверге жібереміз
          if (typeof next.name === "string" && next.name.trim() && next.name.trim() !== u.name) {
            void fetch("/api/auth/me", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: next.name.trim() }),
            }).catch(() => undefined);
          }
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

  // Роль могла измениться (или сессия истечь) пока вкладка была в фоне — перепроверяем доступ к чатам.
  // Не чаще раза в минуту: частые переключения окон не должны каждый раз ходить на сервер.
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
    (patch: Partial<User>) => {
      if (!serverUser) return;
      const next = { ...extra, ...patch };
      // TODO: заменить на fetch("/api/profile", { method: "PATCH", ... })
      localStorage.setItem(extraKey(serverUser), JSON.stringify(next));
      setExtra(next);
      // аты серверде де сақталады — транзакцияларда «логин» емес, профиль аты шығады
      if (typeof patch.name === "string" && patch.name.trim() && patch.name.trim() !== serverUser.name) {
        void fetch("/api/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: patch.name.trim() }),
        })
          .then((r) => (r.ok ? refresh() : undefined))
          .catch(() => undefined);
      }
    },
    [serverUser, extra, refresh]
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