"use client";

import { useState } from "react";
import { REASON_MIN } from "@/lib/moderation-shared";

export type ModerationMode = "hide" | "delete" | "restore" | "unhide";

export type ModerationPayload = {
  reason: string;
  hideDays?: number;
  hiddenUntil?: string;
};

const REASONS = [
  "Нарушение правил публикации",
  "Спам или реклама",
  "Неприемлемый контент",
  "Некорректная информация о книге",
  "Нарушение авторских прав",
  "Дубликат объявления",
];

const TERMS: { key: string; label: string; days?: number }[] = [
  { key: "1", label: "1 день", days: 1 },
  { key: "3", label: "3 дня", days: 3 },
  { key: "7", label: "7 дней", days: 7 },
  { key: "14", label: "14 дней", days: 14 },
  { key: "30", label: "30 дней", days: 30 },
  { key: "forever", label: "Бессрочно" },
  { key: "custom", label: "До даты…" },
];

const TITLES: Record<ModerationMode, string> = {
  hide: "Скрыть книгу",
  delete: "Удалить книгу",
  restore: "Восстановить книгу",
  unhide: "Вернуть книгу в каталог",
};

const HINTS: Record<ModerationMode, string> = {
  hide: "Автор получит уведомление с причиной и сроком. По окончании срока книга вернётся в каталог сама.",
  delete:
    "Книга исчезнет с сайта, но останется в базе вместе с историей — её можно будет восстановить. Автор получит уведомление.",
  restore: "Книга снова станет доступной в каталоге. Автор получит уведомление.",
  unhide: "Скрытие будет снято, книга сразу появится в каталоге. Автор получит уведомление.",
};

const dayInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Диалог действия администрации над книгой: причина (обязательна для скрытия/удаления) и срок скрытия. */
export default function ModerationDialog({
  mode,
  bookTitle,
  busy,
  onSubmit,
  onClose,
}: {
  mode: ModerationMode;
  bookTitle: string;
  busy?: boolean;
  onSubmit: (p: ModerationPayload) => void;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState("");
  const [custom, setCustom] = useState("");
  const [term, setTerm] = useState("7");
  const [date, setDate] = useState("");

  const reason = [preset, custom.trim()].filter(Boolean).join(". ");
  const needReason = mode !== "restore" && mode !== "unhide";
  const tomorrow = dayInput(new Date(Date.now() + 86_400_000));
  const maxDate = dayInput(new Date(Date.now() + 730 * 86_400_000));
  const dateOk = term !== "custom" || (!!date && date >= tomorrow && date <= maxDate);
  const valid = (!needReason || reason.length >= REASON_MIN) && (mode !== "hide" || dateOk);

  function submit() {
    if (!valid) return;
    const p: ModerationPayload = { reason };
    if (mode === "hide") {
      const t = TERMS.find((x) => x.key === term);
      if (t?.days) p.hideDays = t.days;
      else if (term === "custom") {
        // до конца выбранного дня по местному времени
        const [y, m, d] = date.split("-").map(Number);
        p.hiddenUntil = new Date(y, m - 1, d, 23, 59, 59).toISOString();
      }
    }
    onSubmit(p);
  }

  return (
    <div className="mq-overlay" onClick={onClose}>
      <div
        className="mq-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[mode]}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mq-dialog-title">{TITLES[mode]}</h2>
        <p className="mq-dialog-hint">
          «{bookTitle}». {HINTS[mode]}
        </p>

        {mode === "hide" && (
          <>
            <label className="mq-label">Срок скрытия</label>
            <div className="mq-terms">
              {TERMS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`mq-term${term === t.key ? " mq-term-active" : ""}`}
                  onClick={() => setTerm(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {term === "custom" && (
              <input
                type="date"
                value={date}
                min={tomorrow}
                max={maxDate}
                onChange={(e) => setDate(e.target.value)}
                className="mq-input"
                aria-label="Скрыть до"
              />
            )}
          </>
        )}

        <label className="mq-label">Причина{needReason ? "" : " (необязательно)"}</label>
        {needReason && (
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className="mq-input">
            <option value="">— выберите причину —</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={needReason ? "Своё пояснение (необязательно)" : "Комментарий для автора"}
          maxLength={200}
          className="mq-input"
        />

        <div className="mq-reject-btns">
          <button
            type="button"
            className={`mq-btn ${mode === "restore" || mode === "unhide" ? "mq-btn-ok" : "mq-btn-danger"}`}
            disabled={busy || !valid}
            onClick={submit}
          >
            {mode === "hide" ? "Скрыть" : mode === "delete" ? "Удалить" : mode === "unhide" ? "Вернуть в каталог" : "Восстановить"}
          </button>
          <button type="button" className="mq-btn" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
