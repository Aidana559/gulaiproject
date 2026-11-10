"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FiMessageSquare, FiUsers } from "react-icons/fi";

type TabId = "borrowers" | "reviews";

/**
 * Переключатель «Кто взял книгу» / «Отзывы».
 * Высота блока фиксирована: содержимое каждой вкладки скроллится внутри,
 * поэтому смена вкладки или рост списков не двигает соседние колонки.
 * Обе панели остаются смонтированными — введённый текст отзыва не пропадает.
 */
export default function BookTabs({
  borrowers,
  reviews,
  borrowersCount,
  reviewsCount,
}: {
  borrowers: ReactNode;
  reviews: ReactNode;
  borrowersCount: number;
  reviewsCount: number;
}) {
  const [tab, setTab] = useState<TabId>("borrowers");
  const refs = useRef<Record<TabId, HTMLButtonElement | null>>({ borrowers: null, reviews: null });

  const tabs: { id: TabId; label: string; count: number; icon: ReactNode }[] = [
    { id: "borrowers", label: "Кто взял книгу", count: borrowersCount, icon: <FiUsers /> },
    { id: "reviews", label: "Отзывы", count: reviewsCount, icon: <FiMessageSquare /> },
  ];

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next: TabId =
      e.key === "Home" ? "borrowers" : e.key === "End" ? "reviews" : tab === "borrowers" ? "reviews" : "borrowers";
    setTab(next);
    refs.current[next]?.focus();
  }

  return (
    <section className="flex h-[34rem] min-w-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200 lg:h-[36rem]">
      <div
        role="tablist"
        aria-label="Информация о книге"
        onKeyDown={onKeyDown}
        className="flex shrink-0 gap-1 border-b border-stone-200 bg-stone-50/60 p-2"
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition sm:flex-none sm:px-5 ${
                active
                  ? "bg-white text-indigo-700 shadow-sm ring-1 ring-stone-200"
                  : "text-stone-500 hover:bg-white/70 hover:text-stone-800"
              }`}
            >
              <span className="shrink-0">{t.icon}</span>
              <span className="truncate">{t.label}</span>
              <span
                className={`shrink-0 rounded-full px-1.5 text-xs font-medium ${
                  active ? "bg-indigo-100 text-indigo-700" : "bg-stone-200 text-stone-600"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id="panel-borrowers"
        role="tabpanel"
        aria-labelledby="tab-borrowers"
        className={`min-h-0 flex-1 ${tab === "borrowers" ? "block" : "hidden"}`}
      >
        {borrowers}
      </div>
      <div
        id="panel-reviews"
        role="tabpanel"
        aria-labelledby="tab-reviews"
        className={`min-h-0 flex-1 ${tab === "reviews" ? "block" : "hidden"}`}
      >
        {reviews}
      </div>
    </section>
  );
}
