"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { useTaxonomy } from "./TaxonomyProvider";

/**
 * Выпадающее меню «Категории» в шапке: категории и жанры берутся из списков администратора,
 * поэтому новые пункты появляются без правок кода.
 */
export default function CatalogMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { categories, genres } = useTaxonomy();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = () => {
    setOpen(false);
    onNavigate?.();
  };
  const sortedGenres = [...genres].sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
      >
        Категории <FiChevronDown className={`transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(92vw,34rem)] rounded-2xl bg-white p-4 shadow-lg ring-1 ring-stone-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Категории</p>
          <ul className="mt-2 grid grid-cols-2 gap-1">
            {categories.map((c) => (
              <li key={c.key}>
                <Link
                  href={`/catalog?category=${encodeURIComponent(c.key)}`}
                  onClick={go}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>

          {sortedGenres.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-400">Жанры</p>
              <ul className="mt-2 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                {sortedGenres.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/catalog?genre=${encodeURIComponent(g.name)}`}
                      onClick={go}
                      className="inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-indigo-100 hover:text-indigo-700"
                    >
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Link href="/catalog" onClick={go} className="mt-4 inline-block text-sm font-semibold text-indigo-700 hover:underline">
            Весь каталог →
          </Link>
        </div>
      )}
    </div>
  );
}
