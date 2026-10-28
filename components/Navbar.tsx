"use client";

import Link from "next/link";
import { useState } from "react";
import { LinkButton } from "./Button";

const links = [
  { href: "/", label: "Главная" },
  { href: "/catalog", label: "Каталог" },
  { href: "/transactions", label: "Транзакции" },
  { href: "/add", label: "Добавить книгу" },
  { href: "/about", label: "О проекте" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-extrabold text-indigo-700">
          <span className="text-2xl">📚</span> Page2Page
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <LinkButton href="/login" variant="ghost" size="sm">
            Войти
          </LinkButton>
          <LinkButton href="/register" size="sm">
            Регистрация
          </LinkButton>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="Меню"
          aria-expanded={open}
          className="rounded-lg p-2 text-stone-700 hover:bg-stone-100 md:hidden"
        >
          <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-stone-200 bg-white px-4 pb-4 md:hidden">
          <ul className="space-y-1 py-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-base font-medium text-stone-700 hover:bg-stone-100"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <LinkButton href="/login" variant="outline">
              Войти
            </LinkButton>
            <LinkButton href="/register">Регистрация</LinkButton>
          </div>
        </div>
      )}
    </header>
  );
}