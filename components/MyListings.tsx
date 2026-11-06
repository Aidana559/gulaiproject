"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Button, LinkButton } from "./Button";
import type { Book } from "@/data/books";
import { categoryLabels } from "@/data/books";

type Listing = Book & {
  ownerId?: string;
  owner?: string;
  views?: number;
  createdAt?: string;
};

export default function MyListings() {
  const { user } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        // берём побольше и фильтруем по владельцу на клиенте
        const res = await fetch("/api/books?limit=100&sort=new", { cache: "no-store" });
        const json = await res.json();
        const list: Listing[] = json.books ?? json ?? [];
        const mine = list.filter(
          (b) =>
            (b.ownerId != null && String(b.ownerId) === String(user.id)) ||
            b.owner === user.name,
        );
        if (!cancelled) setItems(mine);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function remove(id: number | string) {
    if (!confirm("Удалить объявление?")) return;
    await fetch(`/api/books/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((x) => String(x.id) !== String(id)));
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
          {items.map((b) => (
            <li
              key={b.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link
                  href={`/book/${b.id}`}
                  className="font-semibold text-stone-900 hover:text-indigo-600"
                >
                  {b.title}
                </Link>
                <p className="text-sm text-stone-500">
                  {b.author} · {categoryLabels[b.category] ?? b.category}
                  {b.views != null && ` · ${b.views} просм.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <LinkButton href={`/book/${b.id}/edit`} variant="outline" size="sm">
                  Изменить
                </LinkButton>
                <Button size="sm" variant="danger" onClick={() => remove(b.id)}>
                  Удалить
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
