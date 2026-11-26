"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
const fields = { description: "Краткое описание", extract: "Биография", born: "Дата рождения", died: "Дата смерти", birthPlace: "Место рождения", photo: "HTTPS-ссылка на фото", url: "HTTPS-ссылка на источник" };
type Field = keyof typeof fields;
type Row = { name: string; count: number; info: Partial<Record<Field,string>>; manual: Partial<Record<Field,string>>; aliases: string[]; status: string };
export default function AuthorsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [edit, setEdit] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Partial<Record<Field,string>>>({});
  const [aliases, setAliases] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const res = await fetch("/api/admin/authors", { cache: "no-store" });
    if (!res.ok) throw new Error("Не удалось загрузить авторов");
    setRows((await res.json()).authors);
  }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  async function act(row: Row, action: string) {
    setBusy(true); setError("");
    try {
      const manual = Object.fromEntries(Object.keys(fields).map(k => [k, draft[k as Field] ?? ""]));
      const res = await fetch("/api/admin/authors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: row.name, action, manual, aliases: aliases.split("\n").filter(Boolean) }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Ошибка сохранения");
      await load(); setEdit(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); } finally { setBusy(false); }
  }
  const visible = rows.filter(r => `${r.name} ${r.aliases.join(" ")}`.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || (filter === "bio" ? !r.info.extract : !r.info.photo))).sort((a,b) => sort === "count" ? b.count-a.count : a.name.localeCompare(b.name,"ru"));
  const cls = "rounded-xl border border-stone-300 bg-white/60 px-3 py-2";
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2"><input className={cls} placeholder="Поиск автора" value={search} onChange={e=>setSearch(e.target.value)} /><select className={cls} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Все</option><option value="bio">Без биографии</option><option value="photo">Без фото</option></select><select className={cls} value={sort} onChange={e=>setSort(e.target.value)}><option value="name">По имени</option><option value="count">По числу книг</option></select></div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {visible.map(r=><div key={r.name} className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white/50 p-4"><div className="min-w-40 flex-1"><Link className="font-medium hover:underline" href={`/author/${encodeURIComponent(r.name)}`}>{r.name}</Link><p className="text-sm text-stone-500">Изданий: {r.count} · {r.info.extract ? "Есть биография" : "Нет биографии"} · {r.info.photo ? "Есть фото" : "Нет фото"}</p></div><button className={cls} disabled={busy} onClick={()=>{setEdit(r);setDraft({...r.manual});setAliases(r.aliases.join("\n"));}}>Изменить</button><button className={cls} disabled={busy} onClick={()=>act(r,"refresh")}>Обновить сведения</button></div>)}
    {edit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-label="Редактирование автора" className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-[#f8f5ec] p-6 space-y-3"><h2 className="text-xl">{edit.name}</h2>{(Object.keys(fields) as Field[]).map(k=><label className="block text-sm" key={k}>{fields[k]}<textarea rows={k==="extract"?4:1} className={`${cls} block w-full`} value={draft[k]??""} placeholder={edit.info[k]??""} onChange={e=>setDraft({...draft,[k]:e.target.value})}/></label>)}<label className="block text-sm">Варианты имени (по одному на строку)<textarea className={`${cls} block w-full`} value={aliases} onChange={e=>setAliases(e.target.value)}/></label>{error && <p role="alert">{error}</p>}<div className="flex gap-2"><button disabled={busy} className={cls} onClick={()=>setEdit(null)}>Отмена</button><button disabled={busy} className="rounded-xl bg-[#596740] px-4 py-2 text-white" onClick={()=>act(edit,"save")}>Сохранить</button></div></section></div>}
  </div>;
}
