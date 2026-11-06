import { NextResponse } from "next/server";
import { getAllBooks, getBook } from "@/lib/books-store";
import { readJson, uid, writeJson } from "@/lib/db";
import { bad, forbidden, getActor, isStaff, unauthorized } from "@/lib/server-auth";
import type { Report, Review, User } from "@/lib/types";

const FILE = "reports.json";
const REVIEWS = "reviews.json";

function normalize(r: Report & { bookId?: string }): Report {
  if (r.targetType && r.targetId) return r;
  // старые жалобы только на книги
  return {
    ...r,
    targetType: "book",
    targetId: r.targetId || r.bookId || "",
  };
}

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (!isStaff(actor)) return forbidden();

  const reports = (await readJson<Report[]>(FILE, [])).map(normalize);
  const books = await getAllBooks({ includeHidden: true });
  const reviews = await readJson<Review[]>(REVIEWS, []);
  const users = await readJson<User[]>("users.json", []);

  const enriched = reports
    .map((r) => {
      const reporterName = users.find((u) => String(u.id) === r.reporterId)?.name ?? "?";
      if (r.targetType === "review") {
        const rev = reviews.find((x) => x.id === r.targetId);
        return {
          ...r,
          reporterName,
          reviewText: rev?.text ?? "(отзыв удалён)",
          reviewAuthor: rev?.authorName ?? "?",
          bookId: rev?.targetType === "book" ? rev.targetId : undefined,
          bookTitle:
            rev?.targetType === "book"
              ? books.find((b) => String(b.id) === rev.targetId)?.title ?? "(книга)"
              : undefined,
        };
      }
      return {
        ...r,
        reporterName,
        bookTitle: books.find((b) => String(b.id) === r.targetId)?.title ?? "(удалено)",
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const text = String(body.reason ?? "").trim();
  if (text.length < 5) return bad("Укажите причину (минимум 5 символов)");

  let targetType: "book" | "review" = body.targetType === "review" ? "review" : "book";
  let targetId = String(body.targetId ?? body.bookId ?? "").trim();

  // совместимость: { bookId } без targetType
  if (!body.targetType && body.bookId) {
    targetType = "book";
    targetId = String(body.bookId);
  }

  if (!targetId) return bad("Не указана цель жалобы");

  if (targetType === "book") {
    const book = await getBook(targetId, { includeHidden: true });
    if (!book || book.deleted) return bad("Книга не найдена");
  } else {
    const reviews = await readJson<Review[]>(REVIEWS, []);
    if (!reviews.find((r) => r.id === targetId)) return bad("Отзыв не найден");
  }

  const reports = await readJson<Report[]>(FILE, []);
  reports.push({
    id: uid(),
    targetType,
    targetId,
    bookId: targetType === "book" ? targetId : undefined,
    reporterId: String(actor.id),
    reason: text.slice(0, 500),
    status: "open",
    createdAt: new Date().toISOString(),
  });
  await writeJson(FILE, reports);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (!isStaff(actor)) return forbidden();

  const body = await req.json().catch(() => ({}));
  const { id, status, deleteReview } = body as {
    id?: string;
    status?: "open" | "closed";
    deleteReview?: boolean;
  };

  if (!id) return bad("Нет id жалобы");

  const reports = (await readJson<Report[]>(FILE, [])).map(normalize);
  const r = reports.find((x) => x.id === id);
  if (!r) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  // удалить отзыв прямо из жалобы
  if (deleteReview && r.targetType === "review") {
    const reviews = await readJson<Review[]>(REVIEWS, []);
    await writeJson(
      REVIEWS,
      reviews.filter((rev) => rev.id !== r.targetId),
    );
    r.status = "closed";
  }

  if (status === "open" || status === "closed") {
    r.status = status;
  }

  await writeJson(FILE, reports);
  return NextResponse.json({ ok: true, report: r });
}
