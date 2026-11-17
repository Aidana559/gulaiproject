/** Единая точка настройки места получения библиотечных книг. */
export const LIBRARY = {
  name: "Библиотека Kitapta",
  address: "г. Астана, улица Достык, 11",
  mapUrl: "https://2gis.kz/astana/geo/9570784863331582",
} as const;

/** Книги каталога без аккаунта владельца выдаются библиотекой. */
export function isLibraryBook(book: { ownerId?: string | null }): boolean {
  return book.ownerId == null;
}
