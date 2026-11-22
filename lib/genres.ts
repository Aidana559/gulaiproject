// Клиент-безопасный помощник: все жанры книги в едином формате.
// Для старых записей без genres берётся единственный genre. Названия приводятся к каноническим
// (регистр, синонимы, «ё/е»), повторы убираются — данные в файлах при этом не меняются.
import { normalizeGenreList } from "./categories";

export function genresOf(b: { genre?: string; genres?: string[] }): string[] {
  const list = normalizeGenreList(b.genres ?? [], 50);
  if (list.length) return list;
  return normalizeGenreList(b.genre ?? "", 50);
}
