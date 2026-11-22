export type Role = "admin" | "moderator" | "user";

export type User = {
  id: string | number;
  name: string;
  email?: string;
  role: Role;
  blocked?: boolean;
  muted?: boolean;
  mutedUntil?: string | null;
  muteReason?: string;
  [k: string]: unknown;
};

export type Review = {
  id: string;
  targetType: "book" | "user";
  targetId: string;
  authorId: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
};

export type ReportStatus = "new" | "in_review" | "resolved" | "rejected";

export type ReportTargetType = "book" | "review" | "user";

/** Решение по жалобе. Определяет итоговый статус: no_violation → rejected, остальные → resolved. */
export type ReportDecision =
  | "no_violation" // нарушений нет, жалоба отклонена
  | "violation_confirmed" // нарушение подтверждено (без действий над объектом)
  | "book_hidden" // книга скрыта
  | "book_deleted" // книга удалена
  | "review_deleted"; // отзыв удалён

/** Запись журнала смены статуса жалобы (история сохраняется даже если жалобу вернули в работу). */
export type ReportTrailEntry = {
  at: string;
  byId: string | null;
  byName: string;
  byRole: "admin" | "moderator" | "user" | "system";
  from: ReportStatus;
  to: ReportStatus;
  decision?: ReportDecision;
  note?: string;
};

export type Report = {
  id: string;
  bookId?: string;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  reporterId: string;
  reasonCode?: string;
  reason: string;
  comment?: string;
  status: ReportStatus | "open" | "closed";
  createdAt: string;
  updatedAt?: string;
  /** Имя того, кто работал с жалобой последним (поле осталось с прежних версий) */
  handledBy?: string;
  /** Рассмотрение: кто, когда и какое решение принял — заполняется, когда жалоба resolved / rejected */
  handledById?: string;
  handledByRole?: "admin" | "moderator" | "user" | "system";
  handledAt?: string;
  decision?: ReportDecision;
  decisionNote?: string;
  /** Взята в работу (status = in_review) */
  inReviewBy?: string;
  inReviewAt?: string;
  /** Закрыта вместе с другой жалобой на тот же объект */
  closedWithReportId?: string;
  trail?: ReportTrailEntry[];
};

export type Genre = { id: string; name: string; type: "genre" | "category" };