import { NextResponse } from "next/server";
import { getActor, forbidden, unauthorized } from "@/lib/server-auth";
import { readSupabaseBooks } from "@/lib/supabase-books";
import { bookState } from "@/lib/moderation-shared";

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return forbidden();
  try {
    const books = await readSupabaseBooks();
    const categories: Record<string, number> = Object.create(null);
    for (const book of books) {
      categories[book.category] = (categories[book.category] ?? 0) + 1;
    }
    return NextResponse.json({
      source: "supabase",
      total: books.length,
      categories,
      pending: books.filter((b) => bookState(b) === "pending").length,
      books,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Catalog preview failed", error);
    return NextResponse.json({ error: "Не удалось прочитать каталог Supabase" }, { status: 500 });
  }
}
