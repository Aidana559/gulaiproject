"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Button, LinkButton } from "./Button";
import type { Book } from "@/data/books";
import { categoryLabels } from "@/data/books";
import { genresOf } from "@/lib/genres";
import { STATE_STYLE, bookState, fmtDate, stateLabel } from "@/lib/moderation-shared";

type Listing = Book & {
  ownerId?: string;
  owner?: string;
  views?: number;
  createdAt?: string;
  hidden?: boolean;
  hiddenUntil?: string | null;
  hiddenReason?: string;
  deleted?: boolean;
  deletedReason?: string;
  reviewed?: boolean;
};

export default function MyListings() {
  const { user } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // mine=1 — свои книги в любом состоянии: опубликованные, скрытые, на модерации и удалённые
      const res = await fetch("/api/books?mine=1&limit=100&sort=new", { cache: "no-store" });
      const json = await res.json();
      setItems(Array.isArray(json.books) ? json.books : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    // загрузка своих объявлений при открытии страницы
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [user, load]);

  async function remove(id: number | string) {
    if (!confirm("Удалить объявление?")) return;
    await fetch(`/api/books/${id}`, { method: "DELETE" });
    await load();
  }

  if (!user) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Мои объявления</h2>
        <LinkButton href="/add" size="sm">
          Добавить
        </LinkButton>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Пока нет объявлений.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {items.map((b) => {
            const state = bookState(b);
            const genres = genresOf(b);
            return (
              <li
                key={b.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {state === "published" || state === "pending" ? (
                      <Link href={`/book/${b.id}`} className="font-semibold text-stone-900 hover:text-indigo-600">
                        {b.title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-stone-900">{b.title}</span>
                    )}
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATE_STYLE[state]}`}
                    >
                      {stateLabel(state, b.hiddenUntil)}
                    </span>
                  </div>
                  <p className="text-sm text-stone-500">
                    {b.author} · {categoryLabels[b.category] ?? b.category}
                    {genres.length > 0 && ` · ${genres.join(", ")}`}
                    {b.views != null && ` · ${b.views} просм.`}
                  </p>
                  {state === "hidden" && (
                    <p className="mt-1 text-sm text-amber-800">
                      {b.hiddenUntil ? `Скрыта до ${fmtDate(b.hiddenUntil)}` : "Скрыта администрацией"}
                      {b.hiddenReason ? `. Причина: ${b.hiddenReason}` : ""}
                    </p>
                  )}
                  {state === "deleted" && b.deletedReason && (
                    <p className="mt-1 text-sm text-rose-700">Причина удаления: {b.deletedReason}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <LinkButton href={`/book/${b.id}/info`} variant="ghost" size="sm">
                    Информация
                  </LinkButton>
                  {state !== "deleted" && (
                    <>
                      <LinkButton href={`/book/${b.id}/edit`} variant="outline" size="sm">
                        Изменить
                      </LinkButton>
                      <Button size="sm" variant="danger" onClick={() => remove(b.id)}>
                        Удалить
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
