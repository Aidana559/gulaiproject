export const instant = false;

import Link from "next/link";
import { FiUsers, FiBookOpen, FiFlag, FiCalendar, FiBook, FiClock, FiArrowUpRight, FiCheckCircle, FiChevronRight } from "react-icons/fi";
import UserLink from "@/components/UserLink";
import Avatar from "@/components/Avatar";
import { getTaxonomy } from "@/lib/taxonomy-store";
import { getAllBooks, isHiddenNow, isPendingReview } from "@/lib/books-store";
import { readJson } from "@/lib/db";
import { TARGET_LABEL } from "@/lib/reports";
import type { Report } from "@/lib/types";
import OverviewCharts from "@/components/staff/OverviewCharts";

type U = { id: string; name: string; email?: string; createdAt?: string; blocked?: boolean; muted?: boolean; avatar?: string; avatarUrl?: string };
type B = { status?: string; dueDate?: string };
const card = "min-w-0 rounded-2xl border border-[#e3dfd2] bg-[#fffdf7] p-5 shadow-sm";
const fmt = (iso?: string) => iso ? iso.slice(0, 10).split("-").reverse().join(".") : "—";

export default async function AdminOverviewPage() {
  const [books, users, bookings, reports, taxonomy] = await Promise.all([
    getAllBooks({ includeHidden: true }), readJson<U[]>("users.json", []), readJson<B[]>("bookings.json", []), readJson<Report[]>("reports.json", []), getTaxonomy(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const openReports = reports.filter(r => ["new", "in_review", "open"].includes(r.status));
  const reserved = bookings.filter(b => b.status === "reserved").length;
  const borrowed = bookings.filter(b => b.status === "borrowed");
  const overdue = borrowed.filter(b => (b.dueDate ?? "9999") < today).length;
  const pending = books.filter(isPendingReview).length;
  const stats = [
    { label: "Пользователи", value: users.length, sub: `Заблокировано: ${users.filter(u => u.blocked).length} · mute: ${users.filter(u => u.muted).length}`, Icon: FiUsers, href: "/admin/users" },
    { label: "Объявления", value: books.length, sub: `Скрыто: ${books.filter(b => isHiddenNow(b)).length}`, Icon: FiBookOpen, href: "/admin/books" },
    { label: "Открытые жалобы", value: openReports.length, sub: `Всего жалоб: ${reports.length}`, Icon: FiFlag, href: "/admin/reports" },
    { label: "Бронирования", value: reserved, sub: "Ожидают выдачи", Icon: FiCalendar },
    { label: "На руках", value: borrowed.length - overdue, sub: "Выданы, срок не истёк", Icon: FiBook },
    { label: "Просрочено", value: overdue, sub: "Не вернули в срок", Icon: FiClock },
  ];
  const days = Array.from({ length: 90 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (89 - i));
    const day = d.toISOString().slice(0, 10);
    return { day, users: users.filter(u => u.createdAt?.slice(0, 10) === day).length, books: books.filter(b => b.createdAt?.slice(0, 10) === day).length };
  });
  const cats = taxonomy.categories.map(c => ({ label: c.label, count: books.filter(b => b.category === c.key).length }));
  const other = books.length - cats.reduce((sum, c) => sum + c.count, 0);
  if (other > 0) cats.push({ label: "Другие", count: other });
  const newUsers = [...users].sort((a,b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0,5);
  const recentReports = [...openReports].sort((a,b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0,5);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-normal text-[#302b23]">Обзор платформы</h1><p className="mt-1 text-sm text-stone-500">Мониторинг активности Kitapta</p></div>
        <span className="flex items-center gap-2 rounded-xl border border-[#e3dfd2] px-3 py-2 text-xs text-stone-600"><FiCalendar /> {fmt(today)}</span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(({label,value,sub,Icon,href},i) => {
          const content = <><div className="flex items-center justify-between gap-2"><span className="text-sm">{label}</span><Icon className="size-5 shrink-0" /></div><p className={`mt-3 text-3xl font-bold tabular-nums ${i === 2 && value > 0 || i === 5 && value > 0 ? "text-amber-700" : ""}`}>{value}</p><div className="mt-2 flex items-center justify-between gap-2 text-xs opacity-80"><span>{sub}</span>{href && <FiArrowUpRight />}</div></>;
          const cls = `${card} ${i === 0 ? "!bg-[#505d3d] !text-white" : "text-[#403e32]"}`;
          return href ? <Link key={label} href={href} className={`${cls} transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2`}>{content}</Link> : <div key={label} className={cls}>{content}</div>;
        })}
      </div>
      <OverviewCharts days={days} categories={cats} />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={card}>
          <div className="flex items-center justify-between gap-2"><h2 className="text-lg">Требует внимания</h2><Link href="/admin/reports" className="text-xs text-[#596740] hover:underline">Все жалобы →</Link></div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-[#f3eee0] p-3"><p className="text-xs text-stone-600">Просрочено</p><strong className="text-xl">{overdue}</strong></div><Link href="/admin/books" className="rounded-xl bg-[#f3eee0] p-3 hover:underline"><p className="text-xs text-stone-600">На проверке</p><strong className="text-xl">{pending}</strong></Link></div>
          {recentReports.length ? <ul className="mt-3 divide-y divide-[#e8e3d7]">{recentReports.map(r => <li key={r.id}><Link href="/admin/reports" className="flex items-center gap-3 py-3 hover:underline"><span className="rounded-lg bg-amber-100 p-2 text-amber-800"><FiFlag /></span><span className="min-w-0 flex-1"><span className="block break-words text-sm">{r.comment || r.reason}</span><span className="block text-xs text-stone-500">{TARGET_LABEL[r.targetType] ?? r.targetType} · {fmt(r.createdAt)}</span></span><FiChevronRight className="shrink-0" /></Link></li>)}</ul> : <p className="mt-5 flex items-center gap-2 text-sm text-[#596740]"><FiCheckCircle /> Открытых жалоб нет</p>}
        </section>
        <section className={card}>
          <div className="flex items-center justify-between gap-2"><h2 className="text-lg">Новые пользователи</h2><Link href="/admin/users" className="text-xs text-[#596740] hover:underline">Все пользователи →</Link></div>
          {newUsers.length ? <ul className="mt-3 divide-y divide-[#e8e3d7]">{newUsers.map(u => <li key={u.id} className="flex items-center gap-3 py-3"><UserLink userId={u.id}><Avatar name={u.name} src={u.avatarUrl || u.avatar} className="size-9 text-sm" /></UserLink><div className="min-w-0 flex-1"><UserLink userId={u.id} className="text-sm font-medium">{u.name}</UserLink><p className="truncate text-xs text-stone-500">{u.email}</p></div><span className="shrink-0 text-xs text-stone-500">{fmt(u.createdAt)}</span></li>)}</ul> : <p className="mt-4 text-sm text-stone-500">Пользователей пока нет.</p>}
        </section>
      </div>
    </div>
  );
}
