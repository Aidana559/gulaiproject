"use client";

import { useState } from "react";
import { FiCheckCircle, FiFlag } from "react-icons/fi";
import Modal from "./Modal";
import { Button } from "./Button";

type Props = {
  open: boolean;
  onClose: () => void;
  targetType: "book" | "review";
  targetId: string | number;
  title?: string;
};

/** Окно жалобы на книгу или отзыв. */
export default function ReportModal({ open, onClose, title = "Пожаловаться", ...rest }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {/* форма монтируется только при открытом окне, поэтому состояние сбрасывается само */}
      <ReportForm onClose={onClose} {...rest} />
    </Modal>
  );
}

function ReportForm({
  onClose,
  targetType,
  targetId,
}: Pick<Props, "onClose" | "targetType" | "targetId">) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (reason.trim().length < 5) {
      setError("Опишите причину (минимум 5 символов)");
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
          reason: reason.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Не удалось отправить");
        return;
      }
      setSent(true);
      setTimeout(onClose, 1500);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200"
      >
        <FiCheckCircle className="size-5 shrink-0" /> Жалоба отправлена модераторам
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-stone-700">
        Причина жалобы
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={4}
          autoFocus
          placeholder="Спам, запрещённый контент, оскорбления…"
          className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal"
        />
      </label>
      <p className="text-right text-xs text-stone-400">{reason.length} / 500</p>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" variant="danger" disabled={sending}>
          <FiFlag /> {sending ? "Отправка…" : "Отправить"}
        </Button>
      </div>
    </form>
  );
}
