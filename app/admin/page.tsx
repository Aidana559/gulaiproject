export const instant = false;

import Link from "next/link";
import PageTitle from "@/components/staff/PageTitle";
import { categoryLabels, type Category } from "@/data/books";
import { getAllBooks } from "@/lib/books-store";
import { readJson } from "@/lib/db";
import { TARGET_LABEL } from "@/lib/reports";
import type { Report } from "@/lib/types";

type U = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  createdAt?: string;
  blocked?: boolean;
  muted?: boolean;
};
type B = { status?: string; dueDate?: string };

const card = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200";
const fmt = (iso?: string) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "—");

export default async function AdminOverviewPage() {
  const [books, users, bookings, reports] = await Promise.all([
    getAllBooks({ includeHidden: true }),
    readJson<U[]>("users.json", []),
    readJson<B[]>("bookings.json", []),
    readJson<Report[]>("reports.json", []),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const openReports = reports.filter(
    (r) => r.status === "new" || r.status === "in_review" || r.status === "open",
  );
  const reserved = bookings.filter((b) => b.status === "reserved").length;
  const borrowed = bookings.filter((b) => b.status === "borrowed");
  const overdue = borrowed.filter((b) => (b.dueDate ?? "9999") < today).length;
  const onHands = borrowed.length - overdue;

  const stats = [
    {
      label: "Пользователи",
      value: users.length,
      sub: `заблокировано: ${users.filter((u) => u.blocked).length} · mute: ${users.filter((u) => u.muted).length}`,
    },
    { label: "Объявления", value: books.length, sub: `скрыто: ${books.filter((b) => b.hidden).length}` },
    { label: "Открытые жалобы", value: openReports.length, sub: `всего жалоб: ${reports.length}`, accent: true },
    { label: "Брони", value: reserved, sub: "ждут выдачи" },
    { label: "На руках", value: onHands, sub: "книги выданы" },
    { label: "Просрочено", value: overdue, sub: "не вернули в срок" },
  ];

  // новое за 7 дней
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const perDay = days.map((d) => ({
    day: d,
    label: d.slice(8, 10) + "." + d.slice(5, 7),
    users: users.filter((u) => u.createdAt?.slice(0, 10) === d).length,
    books: books.filter((b) => b.createdAt?.slice(0, 10) === d).length,
  }));
  const maxDay = Math.max(1, ...perDay.flatMap((d) => [d.users, d.books]));

  const cats = (Object.keys(categoryLabels) as Category[]).map((c) => ({
    label: categoryLabels[c],
    count: books.filter((b) => b.category === c).length,
  }));
  const maxCat = Math.max(1, ...cats.map((c) => c.count));

  const newUsers = [...users]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 5);

  return (
    <>
      <PageTitle title="Обзор" hint="Что сейчас происходит на сайте." />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`${card} ${s.accent ? "ring-2 ring-amber-300" : ""}`}
          >
            <p className="text-xs text-stone-500">{s.label}</p>
            <p className={`mt-1 text-3xl font-extrabold ${s.accent ? "text-amber-600" : "text-stone-900"}`}>
              {s.value}
            </p>
            <p className="mt-1 text-xs text-stone-400">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h2 className="text-sm font-bold text-stone-900">Новое за 7 дней</h2>
          <div className="mt-2 flex items-center gap-4 text-xs text-stone-500">
            <span className="flex items-center gap-1.5">
              <i className="inline-block size-2 rounded-full bg-indigo-500" /> Пользователи
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block size-2 rounded-full bg-teal-400" /> Объявления
            </span>
          </div>
          <div className="mt-4 flex h-32 items-end justify-between gap-2">
            {perDay.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-24 items-end gap-1">
                  {[
                    { v: d.users, c: "bg-indigo-500" },
                    { v: d.books, c: "bg-teal-400" },
                  ].map((bar, i) => (
                    <div key={i} className="flex flex-col items-center justify-end">
                      {bar.v > 0 && <span className="text-[10px] text-stone-500">{bar.v}</span>}
                      <div
                        className={`w-3 rounded-t ${bar.c}`}
                        style={{ height: `${Math.max(2, (bar.v / maxDay) * 80)}px` }}
                      />
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-stone-400">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-sm font-bold text-stone-900">Объявления по категориям</h2>
          <ul className="mt-4 space-y-3">
            {cats.map((c) => (
              <li key={c.label}>
                <div className="flex justify-between text-xs text-stone-600">
                  <span>{c.label}</span>
                  <b className="text-stone-900">{c.count}</b>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-stone-100">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500"
                    style={{ width: `${(c.count / maxCat) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-900">Открытые жалобы</h2>
            <Link href="/admin/reports" className="text-xs font-medium text-indigo-600 hover:underline">
              Все →
            </Link>
          </div>
          {openReports.length === 0 ? (
            <p className="mt-4 text-sm text-stone-400">Открытых жалоб нет.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {openReports.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <p className="text-sm text-stone-900">{r.comment || r.reason}</p>
                  <p className="text-xs text-stone-400">
                    {TARGET_LABEL[r.targetType] ?? r.targetType} · {fmt(r.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-900">Новые пользователи</h2>
            <Link href="/admin/users" className="text-xs font-medium text-indigo-600 hover:underline">
              Все →
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {newUsers.map((u) => (
              <li key={u.id}>
                <p className="text-sm font-medium text-stone-900">{u.name}</p>
                <p className="text-xs text-stone-400">
                  {u.email} · {fmt(u.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
