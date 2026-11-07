import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import PageTitle from "@/components/staff/PageTitle";
import { categoryLabels, type Category } from "@/data/books";
import { listUsers } from "@/lib/auth";
import { getAllBooks } from "@/lib/books-store";
import { listBookingsForActor } from "@/lib/bookings";
import { readJson } from "@/lib/db";
import type { Report } from "@/lib/types";

const DAYS = 7;

function lastDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

function formatDate(iso: string) {
  return `${ddmm(iso.slice(0, 10))}.${iso.slice(0, 4)}`;
}

type Stat = { label: string; value: number; note?: string; href?: string; tone?: "warn" | "danger" };

async function Dashboard() {
  await connection();

  const [users, books, reports, bookings] = await Promise.all([
    listUsers(),
    getAllBooks({ includeHidden: true }),
    readJson<Report[]>("reports.json", []),
    listBookingsForActor({ id: "dashboard", name: "admin", role: "admin" }),
  ]);

  const openReports = reports.filter((r) => r.status === "new" || r.status === "open");
  const hiddenBooks = books.filter((b) => b.hidden).length;
  const blocked = users.filter((u) => u.blocked).length;
  const muted = users.filter((u) => u.muted).length;
  const reserved = bookings.filter((b) => b.status === "reserved").length;
  const borrowed = bookings.filter((b) => b.status === "borrowed").length;
  const overdue = bookings.filter((b) => b.status === "overdue").length;

  const stats: Stat[] = [
    {
      label: "Пользователи",
      value: users.length,
      note: `заблокировано: ${blocked} · mute: ${muted}`,
      href: "/admin/users",
    },
    {
      label: "Объявления",
      value: books.length,
      note: `скрыто: ${hiddenBooks}`,
      href: "/admin/books",
    },
    {
      label: "Открытые жалобы",
      value: openReports.length,
      note: `всего жалоб: ${reports.length}`,
      href: "/admin/reports",
      tone: openReports.length > 0 ? "warn" : undefined,
    },
    { label: "Брони", value: reserved, note: "ждут выдачи" },
    { label: "На руках", value: borrowed, note: "книги выданы" },
    {
      label: "Просрочено",
      value: overdue,
      note: "не вернули в срок",
      tone: overdue > 0 ? "danger" : undefined,
    },
  ];

  const days = lastDays(DAYS);
  const usersPerDay = days.map((d) => users.filter((u) => u.createdAt?.slice(0, 10) === d).length);
  const booksPerDay = days.map((d) => books.filter((b) => b.createdAt?.slice(0, 10) === d).length);
  const maxBar = Math.max(1, ...usersPerDay, ...booksPerDay);
  const BAR_H = 90;

  const byCategory = (Object.keys(categoryLabels) as Category[]).map((c) => ({
    key: c,
    label: categoryLabels[c],
    count: books.filter((b) => b.category === c).length,
  }));
  const maxCat = Math.max(1, ...byCategory.map((c) => c.count));

  const latestReports = [...openReports]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  const latestUsers = [...users]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 5);

  return (
    <>
      <div className="dash-stats">
        {stats.map((s) => {
          const body = (
            <>
              <p className="dash-stat-label">{s.label}</p>
              <p className="dash-stat-value">{s.value}</p>
              {s.note && <p className="dash-stat-note">{s.note}</p>}
            </>
          );
          const cls = `dash-stat${s.tone ? ` dash-stat-${s.tone}` : ""}`;
          return s.href ? (
            <Link key={s.label} href={s.href} className={`${cls} dash-stat-link`}>
              {body}
            </Link>
          ) : (
            <div key={s.label} className={cls}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="dash-grid">
        <section className="dash-card">
          <h2 className="dash-card-title">Новое за 7 дней</h2>
          <div className="dash-legend">
            <span>
              <i className="dash-dot dash-dot-users" /> Пользователи
            </span>
            <span>
              <i className="dash-dot dash-dot-books" /> Объявления
            </span>
          </div>
          <div className="dash-chart">
            {days.map((d, i) => (
              <div key={d} className="dash-chart-col">
                <div className="dash-chart-bars" style={{ height: BAR_H }}>
                  <div className="dash-bar-wrap">
                    <span className="dash-bar-num">{usersPerDay[i] || ""}</span>
                    <div
                      className="dash-bar dash-bar-users"
                      style={{ height: Math.max(usersPerDay[i] ? 6 : 2, (usersPerDay[i] / maxBar) * (BAR_H - 16)) }}
                    />
                  </div>
                  <div className="dash-bar-wrap">
                    <span className="dash-bar-num">{booksPerDay[i] || ""}</span>
                    <div
                      className="dash-bar dash-bar-books"
                      style={{ height: Math.max(booksPerDay[i] ? 6 : 2, (booksPerDay[i] / maxBar) * (BAR_H - 16)) }}
                    />
                  </div>
                </div>
                <p className="dash-chart-label">{ddmm(d)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="dash-card">
          <h2 className="dash-card-title">Объявления по категориям</h2>
          <ul className="dash-cats">
            {byCategory.map((c) => (
              <li key={c.key}>
                <div className="dash-cat-head">
                  <span>{c.label}</span>
                  <b>{c.count}</b>
                </div>
                <div className="dash-cat-track">
                  <div className="dash-cat-fill" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Открытые жалобы</h2>
            <Link href="/admin/reports" className="dash-more">
              Все →
            </Link>
          </div>
          {latestReports.length === 0 ? (
            <p className="dash-empty">Открытых жалоб нет</p>
          ) : (
            <ul className="dash-list">
              {latestReports.map((r) => (
                <li key={r.id}>
                  <p className="dash-list-main">{r.reason}</p>
                  <p className="dash-list-sub">
                    {r.targetType === "review" ? "Отзыв" : "Книга"} · {formatDate(r.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Новые пользователи</h2>
            <Link href="/admin/users" className="dash-more">
              Все →
            </Link>
          </div>
          <ul className="dash-list">
            {latestUsers.map((u) => (
              <li key={u.id}>
                <p className="dash-list-main">{u.name}</p>
                <p className="dash-list-sub">
                  {u.email}
                  {u.createdAt ? ` · ${formatDate(u.createdAt)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <>
      <PageTitle title="Обзор" hint="Что сейчас происходит на сайте." />
      <Suspense fallback={<p className="dash-empty">Загрузка…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}