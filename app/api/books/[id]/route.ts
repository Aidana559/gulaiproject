import { NextResponse } from "next/server";
import { getBook, patchBook } from "@/lib/books-store";
import { readJson, writeJson } from "@/lib/db";
import {
  bad, forbidden, getActor, isOwner, isStaff, unauthorized,
} from "@/lib/server-auth";
import type { Report, Review } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };
const EDITABLE = ["title", "author", "description", "genre", "category", "condition", "status", "location", "city"];

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book || book.deleted) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (book.hidden) {
    const a = await getActor(req);
    if (!a || (!isStaff(a) && !isOwner(book, a)))
      return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  return NextResponse.json(book);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  const book = await getBook(id);
  if (!book || book.deleted) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  if (!isOwner(book, actor) && !isStaff(actor)) return forbidden();

  const body = await req.json();
  const patch: Record<string, any> = {};
  for (const k of EDITABLE) {
    if (k in body) patch[k] = typeof body[k] === "string" ? body[k].trim().slice(0, 2000) : body[k];
  }
  if ("hidden" in body) {
    if (!isStaff(actor)) return forbidden();
    patch.hidden = !!body.hidden;
  }
  if (patch.title !== undefined && !patch.title) return bad("Название не может быть пустым");

  await patchBook(id, patch);
  return NextResponse.json({ ...book, ...patch });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  const book = await getBook(id);
  if (!book) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (!isOwner(book, actor) && !isStaff(actor)) return forbidden();

  await patchBook(id, { deleted: true });
  const reviews = await readJson<Review[]>("reviews.json", []);
  await writeJson("reviews.json", reviews.filter((r) => !(r.targetType === "book" && r.targetId === id)));
  const reports = await readJson<Report[]>("reports.json", []);
  await writeJson("reports.json", reports.filter((r) => r.bookId !== id));
  return NextResponse.json({ ok: true });
}