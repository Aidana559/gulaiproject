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

/** Жалоба на книгу или на отзыв */
export type Report = {
  id: string;
  /** @deprecated для старых записей; используй targetType/targetId */
  bookId?: string;
  targetType: "book" | "review";
  targetId: string;
  reporterId: string;
  reason: string;
  status: "open" | "closed";
  createdAt: string;
};

export type Genre = { id: string; name: string; type: "genre" | "category" };
