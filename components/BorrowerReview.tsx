"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheckCircle, FiMessageSquare } from "react-icons/fi";
import { useAuth } from "@/components/AuthProvider";
import Modal from "./Modal";
import { Button } from "./Button";
import { Stars } from "./Stars";

/**
 * Отзыв о читателе (вернул ли книгу вовремя, аккуратен ли).
 * Доступен владельцу книги и персоналу.
 */
export default function BorrowerReview({
  targetId,
  name,
  ownerKey,
}: {
  targetId: string;
  name: string;
  ownerKey: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user) return null;
  const isOwner = String(user.id) === ownerKey || user.name === ownerKey;
  const isStaff = user.role === "admin" || user.role === "moderator";
  const isSelf = String(user.id) === targetId || user.name === targetId;
  if (!(isOwner || isStaff) || isSelf) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "user", targetId, rating, text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Не удалось сохранить");
        return;
      }
      setDone(true);
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setText("");
      }, 1200);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-50"
      >
        <FiMessageSquare /> Отзыв о читателе
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Отзыв о читателе: ${name}`}>
        {done ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200"
          >
            <FiCheckCircle className="size-5 shrink-0" /> Отзыв сохранён
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-stone-700">Оценка</p>
              <Stars value={rating} onChange={setRating} />
            </div>
            <label className="block text-sm font-medium text-stone-700">
              Комментарий
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Вернул вовремя, книга в хорошем состоянии…"
                className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={sending}>
                {sending ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
