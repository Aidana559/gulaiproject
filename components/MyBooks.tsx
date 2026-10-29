"use client";

import { useState } from "react";
import Link from "next/link";
import { books, categoryLabels, statusLabels, type Status } from "@/data/books";
import StatusBadge from "./StatusBadge";
import { Button, LinkButton } from "./Button";

const initial = books.slice(0, 5).map((b) => ({ ...b }));

export default function MyBooks() {
  const [items, setItems] = useState(initial);

  const setStatus = (id: number, status: Status) =>
    setItems((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
      <ul className="divide-y divide-stone-100">
        {items.map((b) => (
          <li key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href={`/book/${b.id}`} className="font-semibold text-stone-900 hover:text-indigo-600">
                {b.title}
              </Link>
              <p className="text-sm text-stone-500">{b.author} · {categoryLabels[b.category]}</p>
              <div className="mt-1"><StatusBadge status={b.status} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusLabels) as Status[])
                .filter((s) => s !== b.status)
                .map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={() => setStatus(b.id, s)}>
                    {statusLabels[s]}
                  </Button>
                ))}
              <Button
                size="sm"
                variant="danger"
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== b.id))}
              >
                Удалить
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <div className="p-10 text-center text-stone-500">
          <p>У вас пока нет объявлений.</p>
          <div className="mt-4"><LinkButton href="/add">Добавить книгу</LinkButton></div>
        </div>
      )}
    </div>
  );
}