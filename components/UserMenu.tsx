"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function UserMenu({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  // undefined — жүктелуде, null — кірмеген
  const [user, setUser] = useState<{ name: string } | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => setUser(res.ok ? (await res.json()).user : null))
      .catch(() => setUser(null));
  }, [pathname]);

  if (user === undefined) return null;

  if (!user) {
    return (
      <>
        <Link href="/login" className={className}>Войти</Link>
        <Link href="/register" className={className}>Регистрация</Link>
      </>
    );
  }

  return (
    <Link href="/profile" className={className}>
      Профиль
    </Link>
  );
}