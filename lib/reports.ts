// Общие константы системы жалоб. Без серверных импортов — можно использовать и на клиенте.
import type { ReportStatus, ReportTargetType } from "./types";

export const REPORT_REASONS = [
  { code: "spam", label: "Спам и реклама" },
  { code: "abuse", label: "Оскорбления и травля" },
  { code: "inappropriate", label: "Неприемлемый контент" },
  { code: "misinformation", label: "Ложная информация" },
  { code: "copyright", label: "Нарушение авторских прав" },
  { code: "fraud", label: "Мошенничество" },
  { code: "wrong_book_info", label: "Некорректная информация о книге" },
  { code: "bad_review", label: "Неподходящий отзыв" },
  { code: "other", label: "Другое" },
] as const;

export type ReasonCode = (typeof REPORT_REASONS)[number]["code"];

/** Причина, при выборе которой показывается поле комментария */
export const OTHER_REASON: ReasonCode = "other";
export const COMMENT_MAX = 500;

export const reasonLabel = (code?: string) =>
  REPORT_REASONS.find((r) => r.code === code)?.label;

export const REPORT_STATUSES: ReportStatus[] = ["new", "in_review", "resolved", "rejected"];

export const STATUS_LABEL: Record<ReportStatus, string> = {
  new: "Новая",
  in_review: "На рассмотрении",
  resolved: "Рассмотрена",
  rejected: "Отклонена",
};

export const STATUS_STYLE: Record<ReportStatus, string> = {
  new: "bg-rose-100 text-rose-700 ring-rose-600/20",
  in_review: "bg-amber-100 text-amber-800 ring-amber-600/20",
  resolved: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
  rejected: "bg-stone-100 text-stone-600 ring-stone-500/20",
};

export const TARGET_LABEL: Record<ReportTargetType, string> = {
  book: "Книга",
  review: "Отзыв",
  user: "Пользователь",
};

/** Приводит статус из старого формата (open/closed) к новому. */
export function normalizeStatus(s: string | undefined): ReportStatus {
  if (s === "closed") return "resolved";
  if (s === "open" || !s) return "new";
  return (REPORT_STATUSES as string[]).includes(s) ? (s as ReportStatus) : "new";
}
