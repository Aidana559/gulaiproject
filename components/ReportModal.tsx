"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiCheckCircle, FiFlag } from "react-icons/fi";
import Modal from "./Modal";
import { Button } from "./Button";
import {
  COMMENT_MAX,
  OTHER_REASON,
  REPORT_REASONS,
  type ReasonCode,
} from "@/lib/reports";
import type { ReportTargetType } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string | number;
  title?: string;
};

const DEFAULT_TITLES: Record<ReportTargetType, string> = {
  book: "Жалоба на объявление",
  review: "Жалоба на отзыв",
  user: "Жалоба на пользователя",
};

/** Окно жалобы на книгу, отзыв или пользователя. */
export default function ReportModal({ open, onClose, title, targetType, targetId }: Props) {
  const [toast, setToast] = useState(false);

  // уведомление живёт здесь, а не в форме: окно закрывается, а оно остаётся
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <Modal open={open} onClose={onClose} title={title ?? DEFAULT_TITLES[targetType]}>
        {/* форма монтируется только при открытом окне, поэтому состояние сбрасывается само */}
        <ReportForm
          onClose={onClose}
          onSent={() => {
            onClose();
            setToast(true);
          }}
          targetType={targetType}
          targetId={targetId}
        />
      </Modal>
      {toast &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg"
          >
            <FiCheckCircle className="size-4 shrink-0 text-emerald-400" />
            Жалоба отправлена. Спасибо, что помогаете сделать сайт лучше!
          </div>,
          document.body,
        )}
    </>
  );
}

function ReportForm({
  onClose,
  onSent,
  targetType,
  targetId,
}: Pick<Props, "onClose" | "targetType" | "targetId"> & { onSent: () => void }) {
  const [reason, setReason] = useState<ReasonCode | "">("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!reason) {
      setError("Выберите причину жалобы");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId: String(targetId),
          reasonCode: reason,
          // комментарий отправляем только для «Другое»
          comment: reason === OTHER_REASON ? comment.trim() : "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Не удалось отправить жалобу");
        return;
      }
      onSent();
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium text-stone-700">Выберите причину жалобы</legend>
        <div className="mt-2 max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
          {REPORT_REASONS.map((r) => {
            const active = reason === r.code;
            return (
              <label
                key={r.code}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600 ${
                  active
                    ? "bg-indigo-50 font-medium text-indigo-900 ring-indigo-300"
                    : "bg-white text-stone-800 ring-stone-200 hover:bg-stone-50"
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.code}
                  checked={active}
                  onChange={() => {
                    setReason(r.code);
                    setError("");
                  }}
                  className="sr-only"
                />
                {r.label}
                {active && <FiCheck className="size-4 shrink-0 text-indigo-600" />}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* поле комментария есть только у причины «Другое» */}
      {reason === OTHER_REASON && (
        <label className="block text-sm font-medium text-stone-700">
          Комментарий <span className="font-normal text-stone-400">(необязательно)</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={COMMENT_MAX}
            rows={3}
            autoFocus
            placeholder="Расскажите, что случилось"
            className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal"
          />
          <span className="block text-right text-xs font-normal text-stone-400">
            {comment.length} / {COMMENT_MAX}
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" variant="danger" disabled={sending || !reason}>
          <FiFlag /> {sending ? "Отправка…" : "Отправить жалобу"}
        </Button>
      </div>
    </form>
  );
}

