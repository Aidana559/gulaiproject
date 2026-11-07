export type Role = "admin" | "moderator" | "user";

export type User = {
  id: string | number;
  name: string;
  email?: string;
  role: Role;
  /** полная блокировка (не может войти) */
  blocked?: boolean;
  /** mute: может пользоваться сайтом, но не публиковать объявления */
  muted?: boolean;
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

/** Статус жалобы. Старые значения "open"/"closed" приводятся к новым при чтении. */
export type ReportStatus = "new" | "in_review" | "resolved" | "rejected";

export type ReportTargetType = "book" | "review" | "user";

/** Жалоба на книгу, отзыв или пользователя */
export type Report = {
  id: string;
  /** @deprecated для старых записей; используй targetType/targetId */
  bookId?: string;
  targetType: ReportTargetType;
  targetId: string;
  /** Снимок объекта на момент жалобы (название книги / текст отзыва / имя пользователя) */
  targetLabel?: string;
  reporterId: string;
  /** Код причины из списка (spam, abuse, …). У старых жалоб его нет. */
  reasonCode?: string;
  /** Читаемое название причины (у старых жалоб — свободный текст) */
  reason: string;
  /** Комментарий — только для причины «Другое» */
  comment?: string;
  status: ReportStatus | "open" | "closed";
  createdAt: string;
  updatedAt?: string;
  handledBy?: string;
};

export type Genre = { id: string; name: string; type: "genre" | "category" };
