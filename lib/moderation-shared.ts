// Общие типы и подписи для модерации книг. Без серверных импортов — можно использовать и на клиенте.

export type ModerationAction =
  | "hidden" // скрыта (временно или бессрочно)
  | "published" // снова опубликована после скрытия
  | "deleted" // удалена администрацией
  | "deleted_by_owner" // удалена самим автором
  | "restored" // восстановлена после удаления
  | "approved" // одобрена на проверке
  | "auto_published"; // скрытие истекло — книга возвращена автоматически

export type BookState = "published" | "pending" | "hidden" | "deleted";

export type ActorRole = "admin" | "moderator" | "user" | "system";

export type ModerationEntry = {
  id: string;
  bookId: string;
  bookTitle: string;
  authorId?: string;
  authorName: string;
  action: ModerationAction;
  actorId: string | null;
  actorName: string;
  actorRole: ActorRole;
  reason?: string;
  /** до какого момента книга скрыта (только для action = hidden) */
  until?: string | null;
  /** статус книги после действия */
  stateAfter: BookState;
  createdAt: string;
};

export const ACTION_LABEL: Record<ModerationAction, string> = {
  hidden: "Скрытие",
  published: "Повторная публикация",
  deleted: "Удаление",
  deleted_by_owner: "Удаление автором",
  restored: "Восстановление",
  approved: "Одобрение",
  auto_published: "Автоматическое восстановление",
};

/** Заголовок «объявления» о действии над книгой */
export function actionHeadline(e: Pick<ModerationEntry, "action" | "until">): string {
  switch (e.action) {
    case "hidden":
      return e.until ? "Книга временно скрыта" : "Книга скрыта";
    case "published":
      return "Книга снова опубликована";
    case "deleted":
    case "deleted_by_owner":
      return "Книга удалена";
    case "restored":
      return "Книга восстановлена";
    case "approved":
      return "Книга одобрена модератором";
    case "auto_published":
      return "Срок скрытия истёк — книга опубликована";
  }
}

/** Название действия в карточке («Действие: …») */
export function actionName(e: Pick<ModerationEntry, "action" | "until">): string {
  if (e.action === "hidden") return e.until ? "Временное скрытие" : "Скрытие (бессрочно)";
  return ACTION_LABEL[e.action];
}

export const ACTOR_ROLE_LABEL: Record<ActorRole, string> = {
  admin: "Администратор",
  moderator: "Модератор",
  user: "Автор",
  system: "Система",
};

export function actorLabel(e: Pick<ModerationEntry, "actorRole" | "actorName">): string {
  return e.actorRole === "system" ? "Система" : `${ACTOR_ROLE_LABEL[e.actorRole]} ${e.actorName}`;
}

export function stateLabel(state: BookState, until?: string | null): string {
  switch (state) {
    case "published":
      return "Опубликована";
    case "pending":
      return "На модерации";
    case "hidden":
      return until ? "Временно скрыта" : "Скрыта";
    case "deleted":
      return "Удалена";
  }
}

export const STATE_STYLE: Record<BookState, string> = {
  published: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
  pending: "bg-sky-100 text-sky-700 ring-sky-600/20",
  hidden: "bg-amber-100 text-amber-800 ring-amber-600/20",
  deleted: "bg-rose-100 text-rose-700 ring-rose-600/20",
};

/** Часовой пояс для текстов, которые формируются на сервере (уведомления) */
export const APP_TZ = "Asia/Almaty";

export function fmtDate(iso?: string | null, tz?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(tz ? { timeZone: tz } : {}),
  }).format(d);
}

export function fmtDateTime(iso?: string | null, tz?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  }).format(d);
}

/** Состояние книги по её полям (и текущему времени). */
export function bookState(
  b: {
    deleted?: boolean;
    hidden?: boolean;
    hiddenUntil?: string | null;
    ownerId?: string | number | null;
    reviewed?: boolean;
  },
  now = Date.now(),
): BookState {
  if (b.deleted) return "deleted";
  if (b.hidden && !(b.hiddenUntil && new Date(b.hiddenUntil).getTime() <= now)) return "hidden";
  // как и в очереди модератора: объявление пользователя, которое ещё не проверили
  if (b.ownerId != null && String(b.ownerId) && !b.reviewed) return "pending";
  return "published";
}

export const REASON_MIN = 3;
export const REASON_MAX = 500;
export const MAX_GENRES = 12;
