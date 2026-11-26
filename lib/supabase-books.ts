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
      const originalGenres: string[] = Array.isArray(original?.genres)
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
        ownerId: row.owner_id ?? undefined,
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
    if (data.length < size) return result;
  }
}
