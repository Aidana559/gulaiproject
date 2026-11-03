"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";

type B = { id: string | number; title: string; author?: string; ownerId: string | number; hidden?: boolean; status?: string };
type R = { id: string; bookId: string; bookTitle: string; reporterName: string; reason: string; status: "open" | "closed"; createdAt: string };

export default function ModerationPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<B[]>([]);
  const [reports, setReports] = useState<R[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setBooks(await api("/api/books?all=1", user.id));
      setReports(await api("/api/reports", user.id));
    } catch (e: any) { setError(e.message); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  if (!user || (user.role !== "moderator" && user.role !== "admin"))
    return <p className="p-6">Доступ только для модераторов.</p>;

  async function hide(id: string | number, hidden: boolean) {
    await api(`/api/books/${id}`, user!.id, { method: "PATCH", body: JSON.stringify({ hidden }) });
    load();
  }
  async function del(id: string | number) {
    if (!confirm("Удалить объявление навсегда?")) return;
    await api(`/api/books/${id}`, user!.id, { method: "DELETE" });
    load();
  }
  async function setReport(id: string, status: "open" | "closed") {
    await api("/api/reports", user!.id, { method: "PATCH", body: JSON.stringify({ id, status }) });
    load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      <h1 className="text-2xl font-semibold">Панель модерации</h1>
      {error && <p className="text-red-600">{error}</p>}

      <section>
        <h2 className="mb-2 text-xl font-semibold">
          Жалобы ({reports.filter((r) => r.status === "open").length} открытых)
        </h2>
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className={`rounded border p-3 ${r.status === "closed" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/books/${r.bookId}`} className="font-medium underline">{r.bookTitle}</Link>
                  <span className="ml-2 text-sm text-gray-500">
                    от {r.reporterName}, {new Date(r.createdAt).toLocaleString("ru-RU")}
                  </span>
                </div>
                <div className="flex gap-2 text-sm">
                  <button onClick={() => hide(r.bookId, true)} className="rounded border px-2 py-1">Скрыть книгу</button>
                  <button onClick={() => del(r.bookId)} className="rounded border px-2 py-1 text-red-600">Удалить книгу</button>
                  <button onClick={() => setReport(r.id, r.status === "open" ? "closed" : "open")} className="rounded border px-2 py-1">
                    {r.status === "open" ? "Закрыть жалобу" : "Открыть снова"}
                  </button>
                </div>
              </div>
              <p className="mt-1">{r.reason}</p>
            </li>
          ))}
          {reports.length === 0 && <li className="text-gray-500">Жалоб нет.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold">Очередь объявлений</h2>
        <table className="w-full border text-left text-sm">
          <thead className="bg-gray-100">
            <tr><th className="p-2">Название</th><th className="p-2">Автор</th><th className="p-2">Статус</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-2"><Link href={`/books/${b.id}`} className="underline">{b.title}</Link></td>
                <td className="p-2">{b.author}</td>
                <td className="p-2">{b.hidden ? "Скрыто" : "Опубликовано"}</td>
                <td className="flex gap-2 p-2">
                  <Link href={`/books/${b.id}/edit`} className="rounded border px-2 py-1">Изменить</Link>
                  <button onClick={() => hide(b.id, !b.hidden)} className="rounded border px-2 py-1">
                    {b.hidden ? "Показать" : "Скрыть"}
                  </button>
                  <button onClick={() => del(b.id)} className="rounded border px-2 py-1 text-red-600">Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}