"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Главная" },
  { href: "/catalog", label: "Каталог" },
  { href: "/transactions", label: "Транзакции" },
  { href: "/add-book", label: "Добавить книгу" },
  { href: "/about", label: "О проекте" },
];

export default function Header() {
  const pathname = usePathname();
  // undefined — жүктелуде, null — кірмеген
  const [user, setUser] = useState<{ name: string } | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => setUser(res.ok ? (await res.json()).user : null))
      .catch(() => setUser(null));
  }, [pathname]);

  const item = (href: string) =>
    `px-4 py-2 font-medium transition-colors hover:text-teal-800 ${
      pathname === href ? "text-teal-800" : "text-stone-600"
    }`;

  return (
    <header className="border-b border-stone-200 bg-white">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center px-4 py-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={item(l.href)}>
            {l.label}
          </Link>
        ))}

        {user === null && (
          <>
            <Link href="/login" className={item("/login")}>Войти</Link>
            <Link href="/register" className={item("/register")}>Регистрация</Link>
          </>
        )}

        {user && (
          <Link href="/profile" className={item("/profile")}>
            Профиль
          </Link>
        )}
      </nav>
    </header>
  );
}