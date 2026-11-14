/** Единая точка настройки места получения библиотечных книг. */
export const LIBRARY = {
  name: "Библиотека Kitapta",
  address: "г. Астана, проспект Ұлы Дала, 56",
  mapUrl: "https://go.2gis.com/9Imfn",
} as const;

/** Книги каталога без аккаунта владельца выдаются библиотекой. */
export function isLibraryBook(book: { ownerId?: string | null }): boolean {
  return book.ownerId == null;
}
