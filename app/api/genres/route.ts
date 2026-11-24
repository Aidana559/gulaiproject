import { NextResponse } from "next/server";
import { getTaxonomy } from "@/lib/taxonomy-store";

// Список жанров для форм (старый формат ответа сохранён). Изменять жанры — через /api/taxonomy (только администратор).
export async function GET() {
  const t = await getTaxonomy();
  return NextResponse.json(t.genres.map((g) => ({ id: g.id, name: g.name, type: "genre" as const })));
}
