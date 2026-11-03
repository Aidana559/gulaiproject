import { NextResponse } from "next/server";
import { getBook } from "@/lib/books-store";
import { readJson, uid, writeJson } from "@/lib/db";
import {
  bad, forbidden, getActor, isOwner, isStaff, unauthorized,
} from "@/lib/server-auth";
import type { Review } from "@/lib/types";

const FILE = "reviews.json";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const type = sp.get("targetType");
  const id = sp.get("targetId");
  const all = await readJson<Review[]>(FILE, []);
  const reviews = all
    .filter((r) => r.targetType === type && r.targetId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const count = reviews.length;
  const average = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  return NextResponse.json({ reviews, average, count });
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  const { targetType, targetId, rating, text } = await req.json();

  if (targetType !== "book" && targetType !== "user") return bad("Неверный тип");
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) return bad("Оценка от 1 до 5");
  const clean = String(text ?? "").trim().slice(0, 1000);
  const tid = String(targetId);

  // targetId пользователя может быть id или именем владельца (если в книгах нет ownerId)
  if (targetType === "user" && (tid === String(actor.id) || tid === actor.name))
    return bad("Нельзя оценить себя");
  if (targetType === "book") {
    const book = await getBook(tid);
    if (!book || book.deleted) return bad("Книга не найдена");
    if (isOwner(book, actor)) return bad("Нельзя оценить свою книгу");
    if (!clean) return bad("Напишите текст отзыва");
  }

  const all = await readJson<Review[]>(FILE, []);
  const existing = all.find(
    (x) => x.targetType === targetType && x.targetId === tid && x.authorId === String(actor.id)
  );
  if (existing) {
    existing.rating = r;
    existing.text = clean;
    existing.createdAt = new Date().toISOString();
  } else {
    all.push({
      id: uid(), targetType, targetId: tid,
      authorId: String(actor.id), authorName: actor.name,
      rating: r, text: clean, createdAt: new Date().toISOString(),
    });
  }
  await writeJson(FILE, all);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  const all = await readJson<Review[]>(FILE, []);
  const rev = all.find((r) => r.id === id);
  if (!rev) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (rev.authorId !== String(actor.id) && !isStaff(actor)) return forbidden();
  await writeJson(FILE, all.filter((r) => r.id !== id));
  return NextResponse.json({ ok: true });
}