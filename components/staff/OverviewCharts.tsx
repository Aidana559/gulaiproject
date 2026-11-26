"use client";

import { useState } from "react";
import Link from "next/link";

type Day = { day: string; users: number; books: number };
type Category = { label: string; count: number };
const colors = ["#53633d", "#879565", "#b5a77d", "#82735d", "#a5ad8e", "#c5bda8"];
const card = "min-w-0 rounded-2xl border border-[#e3dfd2] bg-[#fffdf7] p-5 shadow-sm";
const fmt = (d: string) => d.slice(8,10) + "." + d.slice(5,7);

export default function OverviewCharts({ days, categories }: { days: Day[]; categories: Category[] }) {
  const [period, setPeriod] = useState(7);
  const [selected, setSelected] = useState<string | null>(null);
  const visible = days.slice(-period);
  const step = period === 7 ? 1 : period === 30 ? 3 : 7;
  const groups = Array.from({ length: Math.ceil(visible.length / step) }, (_, i) => {
    const chunk = visible.slice(i * step, (i + 1) * step);
    return { day: chunk[0].day, label: chunk.length === 1 ? fmt(chunk[0].day) : `${fmt(chunk[0].day)}–${fmt(chunk[chunk.length - 1].day)}`, users: chunk.reduce((s,d) => s+d.users,0), books: chunk.reduce((s,d) => s+d.books,0) };
  });
  const max = Math.max(1, ...groups.flatMap(d => [d.users,d.books]));
  const active = groups.find(d => d.day === selected);
  const total = categories.reduce((s,c) => s+c.count,0);
  let offset = 0;
  const segments = categories.map((c,i) => { const start = offset; offset += total ? c.count / total * 100 : 0; return `${colors[i % colors.length]} ${start}% ${offset}%`; });
  return <div className="grid gap-4 xl:grid-cols-2">
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg">Динамика активности</h2><div className="flex rounded-lg bg-[#eeeade] p-1" aria-label="Период статистики">{[7,30,90].map(p => <button key={p} type="button" aria-pressed={p===period} onClick={() => {setPeriod(p);setSelected(null);}} className={`rounded-md px-2 py-1 text-xs ${p===period ? "bg-[#53633d] text-white" : "text-stone-600"}`}>{p} дн.</button>)}</div></div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-600"><span>● Пользователи: {visible.reduce((s,d)=>s+d.users,0)}</span><span className="text-[#78864f]">● Объявления: {visible.reduce((s,d)=>s+d.books,0)}</span></div>
      <div className="mt-4 min-h-8 text-xs text-stone-600" aria-live="polite">{active ? `${active.label}: пользователей — ${active.users}, объявлений — ${active.books}` : "Выберите столбец для просмотра значений"}</div>
      <div className="flex h-36 items-end gap-1 border-b border-[#ddd8ca]">{groups.map(d => <button type="button" key={d.day} title={`${d.label}: ${d.users} пользователей, ${d.books} объявлений`} aria-label={`${d.label}: ${d.users} пользователей, ${d.books} объявлений`} onFocus={()=>setSelected(d.day)} onMouseEnter={()=>setSelected(d.day)} onClick={()=>setSelected(d.day)} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 rounded-t hover:bg-[#f0ede3] focus-visible:outline"><span className="w-[35%] max-w-5 rounded-t bg-[#53633d]" style={{height:`${d.users/max*100}%`}}/><span className="w-[35%] max-w-5 rounded-t bg-[#9ba971]" style={{height:`${d.books/max*100}%`}}/></button>)}</div>
      <div className="mt-2 flex justify-between text-[10px] text-stone-500">{groups.filter((_,i)=>i===0 || i===groups.length-1 || i===Math.floor(groups.length/2)).map(d=><span key={d.day}>{d.label}</span>)}</div>
    </section>
    <section className={card}>
      <div className="flex items-center justify-between gap-2"><h2 className="text-lg">Структура каталога</h2><Link href="/admin/categories" className="text-xs text-[#596740] hover:underline">Категории →</Link></div>
      <div className="mt-5 flex flex-wrap items-center gap-5"><div role="img" aria-label={`Всего изданий: ${total}`} className="relative mx-auto flex size-36 shrink-0 items-center justify-center rounded-full" style={{background:total ? `conic-gradient(${segments.join(",")})` : "#e8e3d7"}}><div className="flex size-28 flex-col items-center justify-center rounded-full bg-[#fffdf7]"><strong className="text-2xl">{total}</strong><span className="text-xs text-stone-500">изданий</span></div></div><ul className="min-w-[140px] flex-1 space-y-3">{categories.map((c,i)=><li key={`${c.label}-${i}`} className="flex items-center gap-2 text-xs"><span className="size-2.5 shrink-0 rounded-full" style={{background:colors[i%colors.length]}}/><span className="min-w-0 flex-1 break-words">{c.label}</span><strong>{c.count}</strong><span className="w-9 text-right text-stone-500">{total ? Math.round(c.count/total*100) : 0}%</span></li>)}</ul></div>
    </section>
  </div>;
}
