// Общие константы системы жалоб. Без серверных импортов — можно использовать и на клиенте.
import type { ReportDecision, ReportStatus, ReportTargetType } from "./types";

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

/** «Текущие» — ждут решения; «История» — уже рассмотрены. */
export const CURRENT_STATUSES: ReportStatus[] = ["new", "in_review"];
export const HISTORY_STATUSES: ReportStatus[] = ["resolved", "rejected"];
export const isHistoryStatus = (s: string | undefined) => s === "resolved" || s === "rejected";

export const DECISIONS: ReportDecision[] = [
  "no_violation",
  "violation_confirmed",
  "book_hidden",
  "book_deleted",
  "review_deleted",
];

export const DECISION_LABEL: Record<ReportDecision, string> = {
  no_violation: "Нарушений нет — жалоба отклонена",
  violation_confirmed: "Нарушение подтверждено",
  book_hidden: "Книга скрыта",
  book_deleted: "Книга удалена",
  review_deleted: "Отзыв удалён",
};

/** Какие решения доступны для жалобы на данный тип объекта. */
export const decisionsForTarget = (t: ReportTargetType): ReportDecision[] =>
  t === "book"
    ? ["no_violation", "violation_confirmed", "book_hidden", "book_deleted"]
    : t === "review"
      ? ["no_violation", "violation_confirmed", "review_deleted"]
      : ["no_violation", "violation_confirmed"];

/** Короткие подписи решений (для бейджей и фильтров). */
export const DECISION_SHORT: Record<ReportDecision, string> = {
  no_violation: "Нарушений нет",
  violation_confirmed: "Нарушение подтверждено",
  book_hidden: "Книга скрыта",
  book_deleted: "Книга удалена",
  review_deleted: "Отзыв удалён",
};

export const DECISION_STYLE: Record<ReportDecision, string> = {
  no_violation: "bg-stone-100 text-stone-700 ring-stone-500/20",
  violation_confirmed: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
  book_hidden: "bg-amber-100 text-amber-800 ring-amber-600/20",
  book_deleted: "bg-rose-100 text-rose-700 ring-rose-600/20",
  review_deleted: "bg-rose-100 text-rose-700 ring-rose-600/20",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "администратор",
  moderator: "модератор",
  user: "автор объявления",
  system: "система",
};

export const NOTE_MAX = 500;

/** Статус, в который жалоба переходит при данном решении. */
export const statusForDecision = (d: ReportDecision): ReportStatus => (d === "no_violation" ? "rejected" : "resolved");

export const isDecision = (v: unknown): v is ReportDecision => typeof v === "string" && (DECISIONS as string[]).includes(v);

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
