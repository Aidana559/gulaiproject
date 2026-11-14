"use client";

import { useAuth } from "@/components/AuthProvider";
import { canManageOwnListings } from "@/lib/listing-access";

/**
 * Показывает содержимое только вошедшему пользователю с ролью `user`
 * (для серверных страниц: кнопки «Добавить книгу» на главной и в подвале).
 * Это только интерфейс; операции и маршрут /add проверяются отдельно на сервере.
 */
export default function UserOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || !user || !canManageOwnListings(user.role)) return null;
  return <>{children}</>;
}
