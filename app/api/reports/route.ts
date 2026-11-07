import { NextResponse } from "next/server";
import { getAllBooks, getBook } from "@/lib/books-store";
import { readJson, uid, writeJson } from "@/lib/db";
import { COMMENT_MAX, OTHER_REASON, REPORT_REASONS, REPORT_STATUSES, normalizeStatus, reasonLabel } from "@/lib/reports";
import { bad, forbidden, getActor, isOwner, isStaff, unauthorized } from "@/lib/server-auth";
import type { Report, ReportStatus, ReportTargetType, Review, User } from "@/lib/types";

const FILE = "reports.json";
const REVIEWS = "reviews.json";
const TARGET_TYPES: ReportTargetType[] = ["book", "review", "user"];

// Файловое хранилище не атомарно: сериализуем чтение-изменение-запись,
// чтобы две одновременные жалобы не затёрли друг друга и дубли не проскочили.
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

/** Приводит старые записи (только книги, статусы open/closed, свободный текст) к новому формату. */
function normalize(r: Report): Report {
  return {
    ...r,
    targetType: r.targetType ?? "book",
    targetId: r.targetId || r.bookId || "",
    status: normalizeStatus(r.status),
  };
}

const snippet = (s: string, n = 200) => (s.length > n ? s.slice(0, n) + "…" : s);

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (!isStaff(actor)) return forbidden();

  const reports = (await readJson<Report[]>(FILE, [])).map(normalize);
  const books = await getAllBooks({ includeHidden: true });
  const reviews = await readJson<Review[]>(REVIEWS, []);
  const users = await readJson<User[]>("users.json", []);

  const perTarget = new Map<string, number>();
  for (const r of reports) {
    const k = `${r.targetType}:${r.targetId}`;
    perTarget.set(k, (perTarget.get(k) ?? 0) + 1);
  }

  const enriched = reports
    .map((r) => {
      const base = {
        ...r,
        reporterName: users.find((u) => String(u.id) === r.reporterId)?.name ?? "?",
        sameTargetCount: perTarget.get(`${r.targetType}:${r.targetId}`) ?? 1,
      };

      if (r.targetType === "review") {
        const rev = reviews.find((x) => x.id === r.targetId);
        const book = rev?.targetType === "book" ? books.find((b) => String(b.id) === rev.targetId) : undefined;
        return {
          ...base,
          targetExists: !!rev,
          reviewText: rev?.text ?? r.targetLabel ?? "(отзыв удалён)",
          reviewAuthor: rev?.authorName,
          bookId: rev?.targetType === "book" ? rev.targetId : undefined,
          bookTitle: rev?.targetType === "book" ? (book?.title ?? "(книга)") : undefined,
        };
      }

      if (r.targetType === "user") {
        const u =
          users.find((x) => String(x.id) === r.targetId) ?? users.find((x) => x.name === r.targetId);
        return {
          ...base,
          targetExists: !!u || books.some((b) => b.owner === r.targetId),
          userName: u?.name ?? r.targetLabel ?? r.targetId,
        };
      }

      const book = books.find((b) => String(b.id) === r.targetId);
      return {
        ...base,
        targetExists: !!book && !book.deleted,
        bookTitle: book?.title ?? r.targetLabel ?? "(удалено)",
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  const body = await req.json().catch(() => ({}));

  // тип и id объекта (совместимость со старым форматом { bookId })
  let targetType = String(body.targetType ?? "") as ReportTargetType;
  let targetId = String(body.targetId ?? body.bookId ?? "").trim();
  if (!body.targetType && body.bookId) targetType = "book";
  if (!TARGET_TYPES.includes(targetType)) return bad("Неверный тип объекта жалобы");
  if (!targetId) return bad("Не указана цель жалобы");

  // причина (старый клиент присылал только свободный текст — считаем его причиной «Другое»)
  let reasonCode = String(body.reasonCode ?? "");
  let comment = String(body.comment ?? "").trim();
  if (!reasonCode && body.reason) {
    reasonCode = OTHER_REASON;
    comment = String(body.reason).trim();
  }
  if (!REPORT_REASONS.some((r) => r.code === reasonCode)) return bad("Выберите причину жалобы");
  // комментарий допустим только для «Другое»
  comment = reasonCode === OTHER_REASON ? comment.slice(0, COMMENT_MAX) : "";

  // проверяем объект, запоминаем что именно было обжаловано
  let targetLabel = "";
  if (targetType === "book") {
    const book = await getBook(targetId, { includeHidden: true });
    if (!book || book.deleted) return bad("Книга не найдена");
    if (isOwner(book, actor)) return bad("Нельзя пожаловаться на своё объявление");
    targetId = String(book.id);
    targetLabel = book.title;
  } else if (targetType === "review") {
    const reviews = await readJson<Review[]>(REVIEWS, []);
    const rev = reviews.find((r) => r.id === targetId);
    if (!rev) return bad("Отзыв не найден");
    if (rev.authorId === String(actor.id)) return bad("Нельзя пожаловаться на свой отзыв");
    targetLabel = `${rev.authorName}: ${snippet(rev.text || `оценка ${rev.rating}/5`)}`;
  } else {
    // id пользователя или имя владельца (в старых книгах нет ownerId)
    const users = await readJson<User[]>("users.json", []);
    const u = users.find((x) => String(x.id) === targetId) ?? users.find((x) => x.name === targetId);
    if (u) {
      targetId = String(u.id);
      targetLabel = u.name;
    } else {
      const books = await getAllBooks({ includeHidden: true });
      const b = books.find((x) => x.owner === targetId);
      if (!b) return bad("Пользователь не найден");
      targetLabel = b.owner;
    }
    if (targetId === String(actor.id) || targetLabel === actor.name)
      return bad("Нельзя пожаловаться на себя");
  }

  return withLock(async () => {
    const reports = (await readJson<Report[]>(FILE, [])).map(normalize);
    const reporterId = String(actor.id);

    // защита от повторов: один пользователь — одна жалоба на один объект
    const dup = reports.find(
      (r) => r.reporterId === reporterId && r.targetType === targetType && r.targetId === targetId,
    );
    if (dup) {
      return NextResponse.json(
        { error: "Вы уже отправили жалобу на этот объект. Мы её рассматриваем." },
        { status: 409 },
      );
    }

    reports.push({
      id: uid(),
      targetType,
      targetId,
      targetLabel,
      bookId: targetType === "book" ? targetId : undefined, // нужен каскадному удалению книги
      reporterId,
      reasonCode,
      reason: reasonLabel(reasonCode) ?? reasonCode,
      comment: comment || undefined,
      status: "new",
      createdAt: new Date().toISOString(),
    });
    await writeJson(FILE, reports);
    return NextResponse.json({ ok: true });
  });
}

export async function PATCH(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (!isStaff(actor)) return forbidden();

  const body = await req.json().catch(() => ({}));
  const { id, deleteReview } = body as { id?: string; status?: string; deleteReview?: boolean };
  if (!id) return bad("Нет id жалобы");

  // принимаем и новые статусы, и старые open/closed
  const rawStatus = body.status as string | undefined;
  let status: ReportStatus | undefined;
  if (rawStatus !== undefined) {
    if (rawStatus === "open" || rawStatus === "closed") status = normalizeStatus(rawStatus);
    else if ((REPORT_STATUSES as string[]).includes(rawStatus)) status = rawStatus as ReportStatus;
    else return bad("Неверный статус жалобы");
  }

  return withLock(async () => {
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
      r.status = "resolved";
    }
    if (status) r.status = status;

    r.updatedAt = new Date().toISOString();
    r.handledBy = actor.name;

    await writeJson(FILE, reports);
    return NextResponse.json({ ok: true, report: r });
  });
}
