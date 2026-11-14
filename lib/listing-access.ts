/**
 * Единая проверка прав на ЛИЧНЫЕ объявления (добавление книги, «Мои объявления»).
 * Без зависимостей от React / Node — используется и в API-роутах, и в интерфейсе.
 *
 * Личными объявлениями управляет только роль `user`. admin и moderator работают с каталогом
 * через свои панели (модерация, скрытие/удаление с причиной) — эти полномочия здесь не затрагиваются.
 */

export const LISTING_ROLE = "user";

/** Может ли роль добавлять книги и управлять собственными объявлениями. */
export const canManageOwnListings = (role: string | null | undefined): boolean => role === LISTING_ROLE;

/** Куда отправить staff, если он открыл пользовательскую страницу объявлений. */
export const staffHomeFor = (role: string | null | undefined): string =>
  role === "admin" ? "/admin" : role === "moderator" ? "/moderation/queue" : "/";

type ActorLike = { id: string | number; name: string; role?: string | null };
type OwnedLike = { ownerId?: string | number | null; owner?: string | null };

/** Владелец книги: по id (если он есть у книги) или, для старых записей без ownerId, по имени. */
export function isListingOwner(book: OwnedLike, actor: ActorLike): boolean {
  if (book.ownerId != null && String(book.ownerId) !== "") return String(book.ownerId) === String(actor.id);
  return !!book.owner && book.owner === actor.name;
}

export type ListingDeny = "unauthenticated" | "role" | "not-owner";

export const LISTING_DENY_MESSAGES: Record<ListingDeny, string> = {
  unauthenticated: "Нужна авторизация",
  role: "Личные объявления доступны только обычным пользователям",
  "not-owner": "Это не ваше объявление",
};

export type ListingDecision = { ok: true } | { ok: false; reason: ListingDeny; message: string };

const deny = (reason: ListingDeny): ListingDecision => ({
  ok: false,
  reason,
  message: LISTING_DENY_MESSAGES[reason],
});

/**
 * Проверка для пользовательских операций: создание (book не передаём) и
 * правка / скрытие / публикация / удаление своего объявления (book обязателен).
 */
export function checkListingAccess(actor: ActorLike | null | undefined, book?: OwnedLike): ListingDecision {
  if (!actor) return deny("unauthenticated");
  if (!canManageOwnListings(actor.role)) return deny("role");
  if (book && !isListingOwner(book, actor)) return deny("not-owner");
  return { ok: true };
}

/** Состояния «Моих объявлений» для фильтров. Модерация и видимость — независимые оси. */
export const LISTING_FILTERS = [
  { key: "all", label: "Все" },
  { key: "published", label: "Опубликованные" },
  { key: "pending", label: "На модерации" },
  { key: "hidden", label: "Скрытые" },
  { key: "rejected", label: "Отклонённые" },
] as const;

export type ListingFilter = (typeof LISTING_FILTERS)[number]["key"];

type FilterBook = {
  deleted?: boolean;
  hidden?: boolean;
  hiddenUntil?: string | null;
  ownerHidden?: boolean;
  reviewed?: boolean;
  ownerId?: string | number | null;
};

/**
 * published — прошла проверку, не отклонена и сейчас видна в каталоге;
 * pending — ещё не проверена модератором (независимо от того, скрыл ли её автор);
 * hidden — скрыта самим автором (ownerHidden);
 * rejected — скрыта модерацией/администрацией (поле hidden, срок скрытия ещё не истёк).
 */
export function matchesListingFilter(b: FilterBook, f: ListingFilter, now = Date.now()): boolean {
  if (f === "all") return true;
  if (b.deleted) return false;
  const staffHidden = !!b.hidden && !(b.hiddenUntil && new Date(b.hiddenUntil).getTime() <= now);
  const pending = !staffHidden && !!b.ownerId && !b.reviewed;
  switch (f) {
    case "rejected":
      return staffHidden;
    case "hidden":
      return !!b.ownerHidden;
    case "pending":
      return pending;
    case "published":
      return !staffHidden && !pending && !b.ownerHidden;
  }
}
