import { NextResponse } from "next/server";
import { getBook } from "@/lib/books-store";
import { bookInfo, sweepExpiredHides } from "@/lib/moderation";
import { forbidden, getActor, isOwner, isStaff, unauthorized } from "@/lib/server-auth";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Подробная информация о книге: статус, жанры, причины и история действий администрации.
 * Автор видит только свои книги, администрация — любые (включая скрытые и удалённые).
 */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  await sweepExpiredHides().catch(() => 0);
  const book = await getBook(id, { includeHidden: true, includeDeleted: true });
  if (!book) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const staff = isStaff(actor);
  if (!staff && !isOwner(book, actor)) return forbidden();

  return NextResponse.json(await bookInfo(book, staff), {
    headers: { "Cache-Control": "no-store" },
  });
}
