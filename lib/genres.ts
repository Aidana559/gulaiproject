// Клиент-безопасный помощник: все жанры книги (для старых записей без genres — единственный genre).
export function genresOf(b: { genre?: string; genres?: string[] }): string[] {
  const list = (b.genres ?? []).filter((x) => x && x !== "—");
  if (list.length) return list;
  return b.genre && b.genre !== "—" ? [b.genre] : [];
}
