"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import { Button } from "@/components/Button";
import { inputClass } from "@/components/FormField";
import { useTaxonomy } from "@/components/TaxonomyProvider";
import { genreKey, type CategoryDef } from "@/lib/categories";
import { useToast } from "./useToast";

type Usage = { categories: Record<string, number>; genres: Record<string, number> };
type GenreDef = { id: string; name: string };
type UsageFilter = "all" | "used" | "unused";
type SortKey = "name" | "count_desc" | "count_asc";

const selectCls = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm";

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");

function plural(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "книга";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "книги";
  return "книг";
}

/** Запрос к /api/taxonomy: ошибка сервера показывается уведомлением, при успехе возвращается ответ. */
async function call(method: string, body?: unknown, query = ""): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  try {
    const res = await fetch(`/api/taxonomy${query}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  } catch {
    return { ok: false, json: { error: "Нет связи с сервером" } };
  }
}

/** Количество книг по категориям/жанрам (только для администратора). */
function useUsage(version: unknown) {
  const [usage, setUsage] = useState<Usage>({ categories: {}, genres: {} });
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/taxonomy?usage=1", { cache: "no-store" });
      const json = res.ok ? await res.json() : null;
      if (json?.usage) setUsage(json.usage);
    } catch {
      /* без счётчиков панель всё равно работает */
    }
  }, []);
  useEffect(() => {
    load();
  }, [load, version]);
  return { usage, reload: load };
}

function Toolbar({
  search,
  setSearch,
  placeholder,
  usageFilter,
  setUsageFilter,
  sort,
  setSort,
  shown,
  total,
}: {
  search: string;
  setSearch: (v: string) => void;
  placeholder: string;
  usageFilter: UsageFilter;
  setUsageFilter: (v: UsageFilter) => void;
  sort: SortKey;
  setSort: (v: SortKey) => void;
  shown: number;
  total: number;
}) {
  const active = !!search || usageFilter !== "all";
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <label className="relative min-w-[200px] flex-1">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          aria-label="Поиск"
          className="w-full rounded-lg border border-stone-300 bg-white py-1.5 pl-9 pr-3 text-sm"
        />
      </label>
      <select value={usageFilter} onChange={(e) => setUsageFilter(e.target.value as UsageFilter)} aria-label="Фильтр" className={selectCls}>
        <option value="all">Все</option>
        <option value="used">С книгами</option>
        <option value="unused">Без книг</option>
      </select>
      <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Сортировка" className={selectCls}>
        <option value="name">По названию</option>
        <option value="count_desc">Больше книг сверху</option>
        <option value="count_asc">Меньше книг сверху</option>
      </select>
      {active && (
        <Button size="sm" variant="ghost" onClick={() => (setSearch(""), setUsageFilter("all"))}>
          <FiX /> Сбросить
        </Button>
      )}
      <span className="text-xs text-stone-400">
        {shown} из {total}
      </span>
    </div>
  );
}

// ======================= КАТЕГОРИИ =======================

export function CategoriesPanel() {
  const { categories, refresh } = useTaxonomy();
  const { usage, reload } = useUsage(categories);
  const { toast, toastNode } = useToast();

  const [label, setLabel] = useState("");
  const [singular, setSingular] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSingular, setEditSingular] = useState("");
  const [del, setDel] = useState<CategoryDef | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const count = (k: string) => usage.categories[k] ?? 0;

  const visible = useMemo(() => {
    const q = norm(search.trim());
    const list = categories.filter(
      (c) =>
        (!q || norm(`${c.label} ${c.singular}`).includes(q)) &&
        (usageFilter === "all" || (usageFilter === "used" ? count(c.key) > 0 : count(c.key) === 0)),
    );
    return [...list].sort((a, b) =>
      sort === "count_desc"
        ? count(b.key) - count(a.key)
        : sort === "count_asc"
          ? count(a.key) - count(b.key)
          : a.label.localeCompare(b.label, "ru"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, usage, search, usageFilter, sort]);

  async function after(ok: boolean, json: Record<string, unknown>, msg: string) {
    if (!ok) {
      toast(String(json.error ?? "Ошибка"));
      return false;
    }
    toast(msg);
    await refresh();
    await reload();
    return true;
  }

  async function add() {
    if (!label.trim()) return;
    setBusy(true);
    const r = await call("POST", { kind: "category", label, singular });
    if (await after(r.ok, r.json, "Категория добавлена")) {
      setLabel("");
      setSingular("");
    }
    setBusy(false);
  }

  async function saveEdit() {
    if (!editKey) return;
    setBusy(true);
    const r = await call("PATCH", { kind: "category", key: editKey, label: editLabel, singular: editSingular });
    if (await after(r.ok, r.json, "Категория изменена")) setEditKey(null);
    setBusy(false);
  }

  async function confirmDelete() {
    if (!del) return;
    setBusy(true);
    const q = `?kind=category&key=${encodeURIComponent(del.key)}${moveTo ? `&moveTo=${encodeURIComponent(moveTo)}` : ""}`;
    const r = await call("DELETE", undefined, q);
    const moved = Number((r.json as { moved?: number }).moved ?? 0);
    if (await after(r.ok, r.json, moved ? `Категория удалена, перенесено книг: ${moved}` : "Категория удалена")) setDel(null);
    setBusy(false);
  }

  return (
    <>
      <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-stone-200">
        <h2 className="text-sm font-bold text-stone-900">Новая категория</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Название (мн. число): Журналы"
            maxLength={40}
            className={inputClass}
            aria-label="Название категории"
          />
          <input
            value={singular}
            onChange={(e) => setSingular(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="В ед. числе: Журнал"
            maxLength={40}
            className={inputClass}
            aria-label="Название в единственном числе"
          />
          <Button size="sm" onClick={add} disabled={busy || !label.trim()}>
            <FiPlus /> Добавить
          </Button>
        </div>
        <p className="mt-2 text-xs text-stone-400">
          Категория сразу появится в меню сайта, фильтре каталога и форме добавления книги.
        </p>
      </section>

      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Поиск по категориям"
        usageFilter={usageFilter}
        setUsageFilter={setUsageFilter}
        sort={sort}
        setSort={setSort}
        shown={visible.length}
        total={categories.length}
      />

      <ul className="mt-3 space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        {visible.length === 0 && <li className="p-4 text-center text-sm text-stone-400">Ничего не найдено</li>}
        {visible.map((c) => (
          <li key={c.key} className="rounded-lg bg-stone-50 px-4 py-2.5 text-sm">
            {editKey === c.key ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} maxLength={40} className={inputClass} aria-label="Название" />
                <input value={editSingular} onChange={(e) => setEditSingular(e.target.value)} maxLength={40} className={inputClass} aria-label="В единственном числе" />
                <Button size="sm" onClick={saveEdit} disabled={busy || !editLabel.trim()}>
                  Сохранить
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditKey(null)}>
                  Отмена
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-stone-800">{c.label}</span>
                  <span className="ml-2 text-xs text-stone-400">
                    ед. число: {c.singular} · ключ: {c.key}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-500">
                    {count(c.key)} {plural(count(c.key))}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                    onClick={() => (setEditKey(c.key), setEditLabel(c.label), setEditSingular(c.singular))}
                  >
                    <FiEdit2 /> Изменить
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline disabled:opacity-40"
                    disabled={categories.length <= 1}
                    onClick={() => (setDel(c), setMoveTo(categories.find((x) => x.key !== c.key)?.key ?? ""))}
                  >
                    <FiTrash2 /> Удалить
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {del && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDel(null)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900">Удалить категорию «{del.label}»?</h2>
            {count(del.key) > 0 ? (
              <>
                <p className="mt-2 text-sm text-stone-600">
                  В ней {count(del.key)} {plural(count(del.key))}. Книги не удаляются — они переедут в выбранную категорию.
                </p>
                <label className="mt-3 block text-sm font-medium text-stone-700">Перенести книги в</label>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={`${selectCls} mt-1 w-full`}>
                  {categories
                    .filter((x) => x.key !== del.key)
                    .map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.label}
                      </option>
                    ))}
                </select>
              </>
            ) : (
              <p className="mt-2 text-sm text-stone-600">В категории нет книг. Её можно удалить без последствий.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDel(null)}>
                Отмена
              </Button>
              <Button variant="danger" size="sm" disabled={busy || (count(del.key) > 0 && !moveTo)} onClick={confirmDelete}>
                Удалить
              </Button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </>
  );
}

// ======================= ЖАНРЫ =======================

export function GenresPanel() {
  const { genres, refresh } = useTaxonomy();
  const { usage, reload } = useUsage(genres);
  const { toast, toastNode } = useToast();

  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [del, setDel] = useState<GenreDef | null>(null);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const count = (g: GenreDef) => usage.genres[genreKey(g.name)] ?? 0;

  const visible = useMemo(() => {
    const q = norm(search.trim());
    const list = genres.filter(
      (g) =>
        (!q || norm(g.name).includes(q)) &&
        (usageFilter === "all" || (usageFilter === "used" ? count(g) > 0 : count(g) === 0)),
    );
    return [...list].sort((a, b) =>
      sort === "count_desc" ? count(b) - count(a) : sort === "count_asc" ? count(a) - count(b) : a.name.localeCompare(b.name, "ru"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genres, usage, search, usageFilter, sort]);

  async function after(ok: boolean, json: Record<string, unknown>, msg: string) {
    if (!ok) {
      toast(String(json.error ?? "Ошибка"));
      return false;
    }
    toast(msg);
    await refresh();
    await reload();
    return true;
  }

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    const r = await call("POST", { kind: "genre", name });
    if (await after(r.ok, r.json, "Жанр добавлен")) setName("");
    setBusy(false);
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true);
    const r = await call("PATCH", { kind: "genre", id: editId, name: editName });
    const n = Number((r.json as { updated?: number }).updated ?? 0);
    if (await after(r.ok, r.json, n ? `Жанр изменён, обновлено книг: ${n}` : "Жанр изменён")) setEditId(null);
    setBusy(false);
  }

  async function confirmDelete() {
    if (!del) return;
    setBusy(true);
    const r = await call("DELETE", undefined, `?kind=genre&id=${encodeURIComponent(del.id)}`);
    const n = Number((r.json as { updated?: number }).updated ?? 0);
    if (await after(r.ok, r.json, n ? `Жанр удалён, снят с книг: ${n}` : "Жанр удалён")) setDel(null);
    setBusy(false);
  }

  return (
    <>
      <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-stone-200">
        <h2 className="text-sm font-bold text-stone-900">Новый жанр</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Например: Поэзия"
            maxLength={60}
            className={inputClass}
            aria-label="Название жанра"
          />
          <Button size="sm" onClick={add} disabled={busy || !name.trim()}>
            <FiPlus /> Добавить
          </Button>
        </div>
        <p className="mt-2 text-xs text-stone-400">Жанр сразу появится в формах добавления и правки книги.</p>
      </section>

      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Поиск по жанрам"
        usageFilter={usageFilter}
        setUsageFilter={setUsageFilter}
        sort={sort}
        setSort={setSort}
        shown={visible.length}
        total={genres.length}
      />

      <ul className="mt-3 space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        {visible.length === 0 && <li className="p-4 text-center text-sm text-stone-400">Ничего не найдено</li>}
        {visible.map((g) => (
          <li key={g.id} className="rounded-lg bg-stone-50 px-4 py-2.5 text-sm">
            {editId === g.id ? (
              <div className="flex flex-wrap gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  maxLength={60}
                  className={`${inputClass} min-w-[200px] flex-1`}
                  aria-label="Название жанра"
                />
                <Button size="sm" onClick={saveEdit} disabled={busy || !editName.trim()}>
                  Сохранить
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                  Отмена
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-stone-800">{g.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-500">
                    {count(g)} {plural(count(g))}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                    onClick={() => (setEditId(g.id), setEditName(g.name))}
                  >
                    <FiEdit2 /> Изменить
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline" onClick={() => setDel(g)}>
                    <FiTrash2 /> Удалить
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {del && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDel(null)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-900">Удалить жанр «{del.name}»?</h2>
            <p className="mt-2 text-sm text-stone-600">
              {count(del) > 0
                ? `Жанр будет снят с ${count(del)} ${plural(count(del))}. Сами книги останутся в каталоге.`
                : "Жанр не используется ни в одной книге."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDel(null)}>
                Отмена
              </Button>
              <Button variant="danger" size="sm" disabled={busy} onClick={confirmDelete}>
                Удалить
              </Button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </>
  );
}
