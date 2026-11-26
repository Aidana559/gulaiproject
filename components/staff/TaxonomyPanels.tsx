"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2, FiFilter, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import CategoryIcon, {
  CATEGORY_ICON_CATALOG,
  FALLBACK_CATEGORY_ICON_KEY,
  ICON_SIZE_SM,
  resolveCategoryIconKey,
} from "@/components/CategoryIcon";
import { Button } from "@/components/Button";
import { inputClass } from "@/components/FormField";
import { useTaxonomy } from "@/components/TaxonomyProvider";
import { categoryPoster, genreKey, type CategoryDef } from "@/lib/categories";
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

function useUsage(version: unknown) {
  const [usage, setUsage] = useState<Usage>({ categories: {}, genres: {} });
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/taxonomy?usage=1", { cache: "no-store" });
      const json = res.ok ? await res.json() : null;
      if (json?.usage) setUsage(json.usage);
    } catch {
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
        <FiSearch className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 ${ICON_SIZE_SM}`} aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          aria-label="Поиск"
          className="w-full rounded-lg border border-stone-300 bg-white py-1.5 pl-9 pr-3 text-sm"
        />
      </label>
      <label className="inline-flex items-center gap-1.5">
        <FiFilter className={`${ICON_SIZE_SM} text-stone-400`} aria-hidden />
        <select value={usageFilter} onChange={(e) => setUsageFilter(e.target.value as UsageFilter)} aria-label="Фильтр" title="Фильтр" className={selectCls}>
          <option value="all">Все</option>
          <option value="used">С книгами</option>
          <option value="unused">Без книг</option>
        </select>
      </label>
      <label className="inline-flex items-center gap-1.5">
        <span className="text-xs font-medium text-stone-400" aria-hidden>А→Я</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Сортировка" title="Сортировка" className={selectCls}>
          <option value="name">По названию</option>
          <option value="count_desc">Больше книг сверху</option>
          <option value="count_asc">Меньше книг сверху</option>
        </select>
      </label>
      {active && (
        <Button size="sm" variant="ghost" onClick={() => (setSearch(""), setUsageFilter("all"))} title="Сбросить фильтры" aria-label="Сбросить фильтры">
          <FiX className={ICON_SIZE_SM} aria-hidden /> Сбросить
        </Button>
      )}
      <span className="text-xs text-stone-400">
        {shown} из {total}
      </span>
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return <label className="block space-y-1 text-sm">Иконка категории
    <div className="flex items-center gap-2"><CategoryIcon category="" icon={value} className="h-6 w-6" />
    <select className={`${selectCls} flex-1`} value={value} onChange={e => onChange(e.target.value)}>
      {CATEGORY_ICON_CATALOG.map(({key,label}) => <option key={key} value={key}>{label}</option>)}
    </select></div></label>;
}

export function CategoriesPanel() {
  const { categories, refresh, loaded } = useTaxonomy();
  const { usage, reload } = useUsage(categories);
  const { toast, toastNode } = useToast();
  const [form, setForm] = useState<{key?: string; label: string; singular: string; icon: string; poster?: string; preview?: string} | null>(null);
  const [del, setDel] = useState<CategoryDef | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [search, setSearch] = useState("");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const count = (key: string) => usage.categories[key] ?? 0;
  const visible = categories.filter(c => (!search.trim() || norm(`${c.label} ${c.singular}`).includes(norm(search.trim()))) && (usageFilter === "all" || (usageFilter === "used" ? count(c.key)>0 : count(c.key)===0))).sort((a,b) => sort === "count_desc" ? count(b.key)-count(a.key) : sort === "count_asc" ? count(a.key)-count(b.key) : a.label.localeCompare(b.label,"ru"));
  const change = (patch: Partial<NonNullable<typeof form>>) => setForm(f => f ? {...f,...patch} : f);
  async function choosePoster(file?: File) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 1000000) { toast("Выберите JPG, PNG или WebP до 1 МБ"); return; }
    setReading(true);
    try {
      const url = await new Promise<string>((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file); });
      change({poster:url,preview:url});
    } catch { toast("Не удалось прочитать изображение"); } finally { setReading(false); }
  }
  async function saveForm() {
    if (!form || busy || reading || !form.label.trim()) return;
    setBusy(true);
    const {preview, ...payload} = form;
    const r = await call(form.key ? "PATCH" : "POST", {kind:"category", ...payload});
    if (r.ok) { setForm(null); await refresh(); await reload(); toast("Категория сохранена"); }
    else toast(String(r.json.error ?? "Ошибка"));
    setBusy(false);
  }
  async function remove() {
    if (!del || busy) return;
    setBusy(true);
    const r = await call("DELETE", undefined, `?kind=category&key=${encodeURIComponent(del.key)}`);
    if (r.ok) {setDel(null); await refresh(); await reload(); toast("Категория удалена");} else toast(String(r.json.error ?? "Ошибка"));
    setBusy(false);
  }
  return <>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-stone-500">Управление типами изданий</p><Button disabled={!loaded || busy} onClick={() => setForm({label:"",singular:"",icon:FALLBACK_CATEGORY_ICON_KEY})}><FiPlus aria-hidden /> Новая категория</Button></div>
    <Toolbar search={search} setSearch={setSearch} placeholder="Поиск по категориям" usageFilter={usageFilter} setUsageFilter={setUsageFilter} sort={sort} setSort={setSort} shown={visible.length} total={categories.length} />
    <ul className="mt-3 space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      {visible.length === 0 && <li className="p-4 text-center text-sm text-stone-400">Ничего не найдено</li>}
      {visible.map(c => <li key={c.key} className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
        <div className="flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-200">{categoryPoster(c) ? <img src={categoryPoster(c)} alt="" className="h-full w-full object-cover" /> : <CategoryIcon category={c.key} icon={c.icon} className="h-7 w-7" />}</div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2 font-medium text-stone-800"><CategoryIcon category={c.key} icon={c.icon} className={ICON_SIZE_SM}/>{c.label}</div><p className="text-xs text-stone-500">{count(c.key)} {plural(count(c.key))}</p></div>
        <details className="relative"><summary className="cursor-pointer list-none rounded-lg px-3 py-2 text-xl hover:bg-stone-200" aria-label={`Действия: ${c.label}`}>⋯</summary><div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border bg-white p-1 shadow-lg">
          <button className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-stone-100" onClick={e => {e.currentTarget.closest('details')?.removeAttribute('open'); setForm({key:c.key,label:c.label,singular:c.singular,icon:resolveCategoryIconKey(c.key,c.icon),preview:categoryPoster(c)});}}>Изменить</button>
          <button disabled={count(c.key)>0 || categories.length<=1} title={count(c.key)>0 ? "Категория содержит книги" : "Удалить"} className="block w-full rounded px-3 py-2 text-left text-sm text-rose-600 hover:bg-stone-100 disabled:opacity-40" onClick={e => {e.currentTarget.closest('details')?.removeAttribute('open');setDel(c);}}>Удалить</button>
        </div></details>
      </li>)}
    </ul>
    {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div role="dialog" aria-modal="true" aria-label={form.key ? "Изменить категорию" : "Новая категория"} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
      <h2 className="text-lg font-bold">{form.key ? "Изменить категорию" : "Новая категория"}</h2>
      <label className="block text-sm">Название категории<input className={`${inputClass} mt-1 w-full`} value={form.label} maxLength={40} onChange={e=>change({label:e.target.value})} placeholder="Журналы" /></label>
      <label className="block text-sm">В единственном числе<input className={`${inputClass} mt-1 w-full`} value={form.singular} maxLength={40} onChange={e=>change({singular:e.target.value})} placeholder="Журнал" /></label>
      <IconPicker value={form.icon} onChange={icon=>change({icon})}/>
      <label className="block text-sm">Постер категории{form.preview && <img src={form.preview} alt="Предпросмотр постера" className="my-2 h-32 w-24 rounded-lg object-cover"/>}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || reading} onChange={e=>void choosePoster(e.target.files?.[0])} className="mt-2 block w-full text-xs"/><span className="text-xs text-stone-500">JPG, PNG, WebP до 1 МБ</span></label>
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy || reading} onClick={()=>setForm(null)}>Отмена</Button><Button disabled={busy || reading || !form.label.trim()} onClick={saveForm}>Сохранить</Button></div>
    </div></div>}
    {del && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div role="dialog" aria-modal="true" aria-label="Удаление категории" className="w-full max-w-md rounded-2xl bg-white p-6"><h2 className="font-bold">Удалить категорию «{del.label}»?</h2><p className="mt-2 text-sm">Удаление возможно только для пустой категории.</p><div className="mt-4 flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setDel(null)}>Отмена</Button><Button variant="danger" disabled={busy} onClick={remove}>Удалить</Button></div></div></div>}
    {toastNode}
  </>;
}


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
            <FiPlus className={ICON_SIZE_SM} aria-hidden /> Добавить
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
                    <FiEdit2 className={ICON_SIZE_SM} aria-hidden /> Изменить
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline" onClick={() => setDel(g)}>
                    <FiTrash2 className={ICON_SIZE_SM} aria-hidden /> Удалить
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
