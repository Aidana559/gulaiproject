/**
 * Статус книги для публичного профиля. Чистый модуль (без Node / React) — общий для сервера и интерфейса.
 *
 *  available — свободна;  reserved — активная бронь;  given — выдана / на руках (в т.ч. просрочена);
 *  returned  — последняя выдача завершена возвратом (книга снова свободна и доступна для брони).
 */
export type LiveBookStatus = "available" | "reserved" | "given" | "returned";

export const LIVE_LABELS: Record<LiveBookStatus, string> = {
  available: "Доступна",
  reserved: "Забронирована",
  given: "На руках",
  returned: "Возвращена",
};

/** Те же цвета, что у каталога (statusStyles), плюс «Возвращена». */
export const LIVE_STYLES: Record<LiveBookStatus, string> = {
  available: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
  reserved: "bg-amber-100 text-amber-700 ring-amber-600/20",
  given: "bg-stone-200 text-stone-600 ring-stone-500/20",
  returned: "bg-sky-100 text-sky-700 ring-sky-600/20",
};

export const LIVE_HINTS: Record<LiveBookStatus, string> = {
  available: "Книгу можно забронировать",
  reserved: "Книга забронирована читателем",
  given: "Книга выдана читателю и сейчас у него",
  returned: "Книгу вернули, её снова можно забронировать",
};
