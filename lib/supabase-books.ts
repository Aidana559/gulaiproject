import "server-only";
import { supabase } from "./supabase-server";
import type { ServerBook } from "./books-store";

type GenreLink = { genres: { name: string } | null };

export async function readSupabaseBooks(): Promise<ServerBook[]> {
  const result: ServerBook[] = [];
  const size = 200;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await supabase
      .from("books")
      .select("*,book_genres(genres(name))")
      .order("id")
      .range(offset, offset + size - 1);
    if (error) throw new Error(error.message);
    for (const row of data) {
      const id = Number(row.id);
      if (!Number.isSafeInteger(id) || String(id) !== row.id) {
        throw new Error(`Unsupported book ID: ${row.id}`);
      }
      const names = (row.book_genres as unknown as GenreLink[])
        .flatMap((link) => link.genres ? [link.genres.name] : []);
      const original = row.legacy_data?.user ?? row.legacy_data?.catalog;
      const originalGenres: string[] = Array.isArray(row.legacy_data?.runtime_genres) ? row.legacy_data.runtime_genres : Array.isArray(original?.genres)
        ? original.genres : original?.genre ? [original.genre] : [];
      const key = (name: string) => name.trim().toLowerCase().replace(/ё/g, "е");
      const ordered = originalGenres.flatMap((name) => names.filter((n) => key(n) === key(name)));
      const genres = [...new Set([...ordered, ...names])];
      result.push({
        id,
        title: row.title,
        author: row.author ?? "",
        category: row.category_key,
        genre: genres[0] ?? "—",
        genres,
        status: row.status,
        owner: row.owner_name ?? "",
        ownerId: row.owner_id ?? row.legacy_owner_id ?? undefined,
        city: row.city ?? "—",
        year: row.year ?? 0,
        pages: row.pages ?? 0,
        description: row.description ?? "",
        isbn: row.isbn ?? undefined,
        googleId: row.google_id ?? undefined,
        gradient: row.gradient ?? "",
        coverUrl: row.cover_url ?? null,
        campus: row.campus ?? undefined,
        condition: row.condition ?? undefined,
        views: row.views,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? undefined,
        reviewed: row.reviewed,
        hidden: row.hidden,
        deleted: row.deleted,
        ownerHidden: row.owner_hidden,
        ownerHiddenAt: row.owner_hidden_at ?? undefined,
        hiddenUntil: row.hidden_until,
        hiddenReason: row.hidden_reason ?? undefined,
        hiddenAt: row.hidden_at ?? undefined,
        hiddenBy: row.hidden_by ?? undefined,
        deletedAt: row.deleted_at ?? undefined,
        deletedReason: row.deleted_reason ?? undefined,
        deletedBy: row.deleted_by ?? undefined,
        moderationNote: row.moderation_note ?? undefined,
      });
    }
    if (data.length < size) return result.sort((a, b) => Number(a.id) - Number(b.id));
  }
}

const fields = {
  title: "title", author: "author", category: "category_key", ownerId: "owner_id", owner: "owner_name",
  description: "description", isbn: "isbn", googleId: "google_id", coverUrl: "cover_url", gradient: "gradient",
  city: "city", campus: "campus", year: "year", pages: "pages", condition: "condition", status: "status",
  views: "views", reviewed: "reviewed", hidden: "hidden", deleted: "deleted", ownerHidden: "owner_hidden",
  ownerHiddenAt: "owner_hidden_at", hiddenUntil: "hidden_until", hiddenReason: "hidden_reason", hiddenAt: "hidden_at",
  hiddenBy: "hidden_by", deletedAt: "deleted_at", deletedReason: "deleted_reason", deletedBy: "deleted_by",
  moderationNote: "moderation_note", createdAt: "created_at", updatedAt: "updated_at",
} as const;

export async function saveSupabaseBook(book: Partial<ServerBook> & { id: number }, create: boolean): Promise<ServerBook> {
  const values: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(fields)) {
    if (Object.prototype.hasOwnProperty.call(book, key)) values[column] = book[key as keyof ServerBook] ?? null;
  }
  const { data, error } = await supabase.rpc("kitapta_save_book", {
    p_id: String(book.id), p_values: values, p_create: create, p_genres: book.genres ?? null,
  });
  if (error) throw new Error(error.message);
  const saved = (await readSupabaseBooks()).find((b) => String(b.id) === String(data));
  if (!saved) throw new Error("Книга не найдена после сохранения");
  return saved;
}

export async function incrementSupabaseViews(id: string): Promise<void> {
  const { error } = await supabase.rpc("kitapta_increment_views", { p_id: id });
  if (error) throw new Error(error.message);
}
