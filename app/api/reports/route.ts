import { NextResponse } from "next/server";
import { getAllBooks, getBook, isHiddenNow } from "@/lib/books-store";
import { readJson, uid, writeJson } from "@/lib/db";
import {
  COMMENT_MAX,
  NOTE_MAX,
  OTHER_REASON,
  REPORT_REASONS,
  REPORT_STATUSES,
  decisionsForTarget,
  isDecision,
  isHistoryStatus,
  normalizeStatus,
  reasonLabel,
} from "@/lib/reports";
import { REPORTS_FILE, applyDecision, normalizeReport as normalize, withReportsLock as withLock } from "@/lib/reports-server";
import { bad, forbidden, getActor, isOwner, isStaff, unauthorized } from "@/lib/server-auth";
import type { Report, ReportDecision, ReportStatus, ReportTargetType, Review, User } from "@/lib/types";

const FILE = REPORTS_FILE;
const REVIEWS = "reviews.json";
const TARGET_TYPES: ReportTargetType[] = ["book", "review", "user"];

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

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    action?: string;
    decision?: string;
    note?: string;
    status?: string;
    deleteReview?: boolean;
  };
  if (!body.id) return bad("Нет id жалобы");
  const id = String(body.id);

  // Совместимость со старым клиентом: { status } и { deleteReview } переводим в действия
  let action = body.action;
  let decision = body.decision;
  if (!action) {
    if (body.deleteReview) {
      action = "resolve";
      decision = "review_deleted";
    } else if (body.status !== undefined) {
      const st = normalizeStatus(body.status);
      if (body.status !== "open" && body.status !== "closed" && !(REPORT_STATUSES as string[]).includes(body.status))
        return bad("Неверный статус жалобы");
      if (st === "in_review") action = "take";
      else if (st === "new") action = "reopen";
      else {
        action = "resolve";
        decision = st === "rejected" ? "no_violation" : "violation_confirmed";
      }
    }
  }
  if (action !== "take" && action !== "resolve" && action !== "reopen") return bad("Неизвестное действие");
  const note = String(body.note ?? "").trim().slice(0, NOTE_MAX);
  const by = { id: String(actor.id), name: actor.name, role: actor.role as "admin" | "moderator" };

  // вернуть жалобу из истории в работу может только администратор
  if (action === "reopen" && actor.role !== "admin") return forbidden();

  if (action === "resolve") {
    if (!isDecision(decision)) return bad("Выберите решение по жалобе");
  }

  return withLock(async () => {
    const reports = (await readJson<Report[]>(FILE, [])).map(normalize);
    const r = reports.find((x) => x.id === id);
    if (!r) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    const done = isHistoryStatus(r.status);
    const now = new Date().toISOString();

    if (action === "take") {
      if (done) return NextResponse.json({ error: "Жалоба уже рассмотрена", report: r }, { status: 409 });
      if (r.status === "new") {
        r.trail = [
          ...(r.trail ?? []),
          { at: now, byId: by.id, byName: by.name, byRole: by.role, from: "new" as ReportStatus, to: "in_review" as ReportStatus },
        ];
        r.status = "in_review";
        r.inReviewBy = by.name;
        r.inReviewAt = now;
        r.updatedAt = now;
      }
    } else if (action === "reopen") {
      if (!done) return NextResponse.json({ ok: true, report: r });
      r.trail = [
        ...(r.trail ?? []),
        { at: now, byId: by.id, byName: by.name, byRole: by.role, from: r.status as ReportStatus, to: "in_review" as ReportStatus, note: "Возвращена в работу" },
      ];
      r.status = "in_review";
      r.inReviewBy = by.name;
      r.inReviewAt = now;
      r.updatedAt = now;
      // сведения о прошлом рассмотрении остаются в trail; в карточке «Текущие» они не нужны
      r.decision = undefined;
      r.decisionNote = undefined;
      r.handledAt = undefined;
      r.handledById = undefined;
      r.handledByRole = undefined;
      r.handledBy = undefined;
      r.closedWithReportId = undefined;
    } else {
      const d = decision as ReportDecision;
      if (done) return NextResponse.json({ error: "Жалоба уже рассмотрена", report: r }, { status: 409 });
      if (!decisionsForTarget(r.targetType).includes(d)) return bad("Это решение не подходит для данной жалобы");

      if (d === "book_hidden" || d === "book_deleted") {
        // скрытие и удаление выполняются отдельным запросом (с причиной), здесь проверяем, что оно действительно сделано
        const book = await getBook(r.targetId, { includeHidden: true, includeDeleted: true });
        const ok = !book || book.deleted || (d === "book_hidden" && isHiddenNow(book));
        if (!ok) return bad(d === "book_hidden" ? "Сначала скройте книгу" : "Сначала удалите книгу");
      }
      if (d === "review_deleted") {
        const reviews = await readJson<Review[]>(REVIEWS, []);
        if (reviews.some((rev) => rev.id === r.targetId)) {
          await writeJson(REVIEWS, reviews.filter((rev) => rev.id !== r.targetId));
        }
      }

      applyDecision(r, d, by, note);

      // действие над объектом закрывает и остальные жалобы на него — каждая со своей записью в истории
      if (d === "book_hidden" || d === "book_deleted" || d === "review_deleted") {
        for (const o of reports) {
          if (o.id === r.id || o.targetType !== r.targetType || o.targetId !== r.targetId) continue;
          if (isHistoryStatus(o.status)) continue;
          applyDecision(o, d, by, note, r.id);
        }
      }
    }

    await writeJson(FILE, reports);
    return NextResponse.json({ ok: true, report: r });
  });
}
