"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { inputClass } from "@/components/FormField";
import { genres } from "@/data/books";
import PageTitle from "@/components/staff/PageTitle";
import { useToast } from "@/components/staff/useToast";

const STORAGE_KEY = "p2p-custom-genres";

export default function AdminGenresPage() {
  const [customGenres, setCustomGenres] = useState<string[]>([]);
  const [newGenre, setNewGenre] = useState("");
  const { toast, toastNode } = useToast();

  useEffect(() => {
    try {
      setCustomGenres(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
    } catch {
      /* пусто */
    }
  }, []);

  function persist(next: string[]) {
    setCustomGenres(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addGenre() {
    const g = newGenre.trim();
    if (!g) return;
    persist(Array.from(new Set([...customGenres, g])));
    setNewGenre("");
    toast("Жанр добавлен (локально)");
  }

  return (
    <>
      <PageTitle title="Жанры" hint="Жанры из каталога и добавленные вручную." />

      <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-stone-200">
        <ul className="space-y-2">
          {genres.map((g) => (
            <li key={g} className="rounded-lg bg-stone-50 px-4 py-2.5 text-sm text-stone-800">
              {g}
            </li>
          ))}
          {customGenres.map((g) => (
            <li
              key={g}
              className="flex items-center justify-between rounded-lg bg-indigo-50 px-4 py-2.5 text-sm"
            >
              <span className="font-medium text-indigo-900">{g}</span>
              <button
                type="button"
                onClick={() => persist(customGenres.filter((x) => x !== g))}
                className="text-xs font-medium text-rose-600 hover:underline"
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <input
            value={newGenre}
            onChange={(e) => setNewGenre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGenre()}
            placeholder="Новый жанр"
            className={inputClass}
          />
          <Button size="sm" onClick={addGenre}>
            Добавить
          </Button>
        </div>
      </section>
      {toastNode}
    </>
  );
}
