"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { categoryLabels, type Category } from "@/data/books";
import { useToast } from "./useToast";

type QueueBook = {
  id: number | string;
  title: string;
  author: string;
  category: Category;
  genre?: string;
  owner?: string;
  ownerId?: string;
  createdAt?: string;
  description?: string;
  coverUrl?: string | null;
  reviewed?: boolean;
  hidden?: boolean;
  deleted?: boolean;
};


const REASONS = [
  "Нет обложки",
  "Неверная категория или жанр",
  "Слишком короткое описание",
  "Дубликат объявления",
  "Нарушает правила сайта",
];

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}


export default function QueuePanel() {
  const [items, setItems] = useState<QueueBook[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/books?all=1&limit=100&sort=new", { cache: "no-store" });
      const json = res.ok ? await res.json() : {};
      const list: QueueBook[] = Array.isArray(json?.books) ? json.books : [];
      setItems(list.filter((b) => b.ownerId && !b.reviewed && !b.hidden && !b.deleted));
    } catch {
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string | number, body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/books/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast(res.ok ? okMsg : "Ошибка");
    } catch {
      toast("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
    setRejecting(null);
    setReason("");
    setCustom("");
    await load();
  }

  const approve = (id: string | number) =>
    patch(id, { reviewed: true }, "Объявление одобрено");

  function reject(id: string | number) {
    const note = [reason, custom.trim()].filter(Boolean).join(". ");
    if (!note) {
      toast("Укажите причину");
      return;
    }
    patch(id, { hidden: true, reviewed: true, moderationNote: note }, "Объявление скрыто");
  }

  return (
    <>
      {loaded && items.length > 0 && (
        <p className="mq-count">На проверке: {items.length}</p>
      )}

      <ul className="mq-list">
        {items.map((b) => {
          const open = rejecting === String(b.id);
          return (
            <li key={b.id} className="mq-card">
              <div className="mq-row">
                {b.coverUrl ? (
                  <img src={b.coverUrl} alt="" className="mq-cover" />
                ) : (
                  <div className="mq-cover mq-cover-empty">нет обложки</div>
                )}

                <div className="mq-info">
                  <Link href={`/book/${b.id}`} className="mq-title">
                    {b.title}
                  </Link>
                  <p className="mq-meta">
                    {b.author} · {categoryLabels[b.category] ?? b.category}
                    {b.genre && b.genre !== "—" ? ` · ${b.genre}` : ""}
                  </p>
                  <p className="mq-meta">
                    Добавил: {b.owner ?? "?"}
                    {b.createdAt ? ` · ${formatDate(b.createdAt)}` : ""}
                  </p>
                  {b.description && <p className="mq-desc">{b.description}</p>}
                </div>

                <div className="mq-actions">
                  <button
                    type="button"
                    className="mq-btn mq-btn-ok"
                    disabled={busy}
                    onClick={() => approve(b.id)}
                  >
                    Одобрить
                  </button>
                  <button
                    type="button"
                    className="mq-btn"
                    disabled={busy}
                    onClick={() => setRejecting(open ? null : String(b.id))}
                  >
                    Скрыть…
                  </button>
                </div>
              </div>

              {open && (
                <div className="mq-reject">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mq-input"
                  >
                    <option value="">— выберите причину —</option>
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="Своё пояснение (необязательно)"
                    maxLength={200}
                    className="mq-input"
                  />
                  <div className="mq-reject-btns">
                    <button
                      type="button"
                      className="mq-btn mq-btn-danger"
                      disabled={busy}
                      onClick={() => reject(b.id)}
                    >
                      Скрыть объявление
                    </button>
                    <button type="button" className="mq-btn" onClick={() => setRejecting(null)}>
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {loaded && items.length === 0 && (
        <div className="mq-empty">Очередь пуста — все объявления проверены.</div>
      )}
      {!loaded && <div className="mq-empty">Загрузка…</div>}
      {toastNode}
    </>
  );
}