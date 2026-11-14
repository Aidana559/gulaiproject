import { readJson, uid, withLock, writeJson } from "@/lib/db";
import { getAllBooks, getBook, patchBook, type ServerBook } from "@/lib/books-store";
import { notify, resolveUserId } from "@/lib/notifications";
import { findUserById } from "@/lib/auth";
import {
  APP_TZ,
  actionHeadline,
  actorLabel,
  bookState,
  fmtDate,
  stateLabel,
  type ActorRole,
  type ModerationAction,
  type ModerationEntry,
} from "@/lib/moderation-shared";

const LOG_FILE = "moderation-log.json";
const LOCK = "moderation";

export type Actor = { id: string; name: string; role: ActorRole };

export const SYSTEM_ACTOR: Actor = { id: "system", name: "Система", role: "system" };

export async function readLog(): Promise<ModerationEntry[]> {
  return readJson<ModerationEntry[]>(LOG_FILE, []);
}

/** История действий над одной книгой (новые — первыми). Работает и для удалённых книг. */
export async function historyFor(bookId: string | number): Promise<ModerationEntry[]> {
  const all = await readLog();
  return all
    .filter((e) => e.bookId === String(bookId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function notificationText(e: ModerationEntry): string {
  const parts = [`${actionHeadline(e)}: «${e.bookTitle}».`, `Выполнил: ${actorLabel(e)}.`];
  if (e.reason) parts.push(`Причина: ${e.reason}.`);
  if (e.action === "hidden" && e.until) parts.push(`Скрыта до ${fmtDate(e.until, APP_TZ)}.`);
  return parts.join(" ");
}

/**
 * Записывает действие в журнал и (если действие не самого автора) уведомляет автора.
 * Дубли исключены: ключ уведомления привязан к id записи журнала, а повторное одинаковое
 * действие над книгой в том же состоянии отсекается вызывающим кодом.
 */
async function record(
  book: ServerBook,
  action: ModerationAction,
  actor: Actor,
  extra: { reason?: string; until?: string | null; stateAfter: ModerationEntry["stateAfter"] },
): Promise<ModerationEntry> {
  const authorId = await resolveUserId({ ownerId: book.ownerId, ownerName: book.owner });
  const entry: ModerationEntry = {
    id: uid(),
    bookId: String(book.id),
    bookTitle: book.title,
    authorId,
    authorName: book.owner,
    action,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    reason: extra.reason || undefined,
    until: action === "hidden" ? (extra.until ?? null) : undefined,
    stateAfter: extra.stateAfter,
    createdAt: new Date().toISOString(),
  };

  await withLock(LOCK, async () => {
    const log = await readLog();
    log.push(entry);
    await writeJson(LOG_FILE, log);
  });

  const selfAction = actor.role === "user" || (authorId != null && authorId === actor.id);
  if (!selfAction) {
    await notify(authorId, {
      type: "moderation",
      text: notificationText(entry),
      href: `/book/${entry.bookId}/info`,
      key: `mod:${entry.id}`,
      moderation: entry,
    });
  }
  return entry;
}

const cleanReason = (r?: string | null) => (r ?? "").trim().slice(0, 500) || undefined;

/** Скрыть книгу (временно, если задан until). Повтор с теми же параметрами — без эффекта. */
export async function hideBook(
  book: ServerBook,
  actor: Actor,
  opts: { reason?: string; until?: string | null },
): Promise<ServerBook | undefined> {
  const reason = cleanReason(opts.reason);
  const until = opts.until ?? null;
  const now = new Date().toISOString();

  if (book.hidden && (book.hiddenUntil ?? null) === until && (book.hiddenReason ?? undefined) === reason) {
    return book; // то же самое скрытие уже действует — не дублируем запись и уведомление
  }

  const updated = await patchBook(String(book.id), {
    hidden: true,
    hiddenUntil: until,
    hiddenReason: reason,
    hiddenAt: now,
    hiddenBy: { id: actor.id, name: actor.name, role: actor.role },
    moderationNote: reason,
  });
  await record(book, "hidden", actor, { reason, until, stateAfter: "hidden" });
  return updated;
}

/** Снять скрытие (вручную). */
export async function unhideBook(
  book: ServerBook,
  actor: Actor,
  opts: { reason?: string } = {},
): Promise<ServerBook | undefined> {
  if (!book.hidden) return book;
  const updated = await patchBook(String(book.id), clearHide());
  const state = bookState({ ...book, hidden: false, hiddenUntil: null });
  await record(book, "published", actor, { reason: cleanReason(opts.reason), stateAfter: state });
  return updated;
}

const clearHide = (): Partial<ServerBook> => ({
  hidden: false,
  hiddenUntil: null,
  hiddenReason: undefined,
  hiddenAt: undefined,
  hiddenBy: undefined,
  moderationNote: undefined,
});

/** Мягкое удаление: книга остаётся в базе с пометкой deleted, история сохраняется. */
export async function deleteBook(
  book: ServerBook,
  actor: Actor,
  opts: { reason?: string },
): Promise<void> {
  if (book.deleted) return;
  const reason = cleanReason(opts.reason);
  await patchBook(String(book.id), {
    deleted: true,
    deletedAt: new Date().toISOString(),
    deletedReason: reason,
    deletedBy: { id: actor.id, name: actor.name, role: actor.role },
  });
  await record(book, actor.role === "user" ? "deleted_by_owner" : "deleted", actor, {
    reason,
    stateAfter: "deleted",
  });
}

/** Восстановить удалённую книгу — она снова публикуется. */
export async function restoreBook(
  book: ServerBook,
  actor: Actor,
  opts: { reason?: string } = {},
): Promise<ServerBook | undefined> {
  if (!book.deleted) return book;
  const updated = await patchBook(String(book.id), {
    deleted: false,
    deletedAt: undefined,
    deletedReason: undefined,
    deletedBy: undefined,
    ...clearHide(),
  });
  const state = bookState({ ...book, deleted: false, hidden: false, hiddenUntil: null });
  await record(book, "restored", actor, { reason: cleanReason(opts.reason), stateAfter: state });
  return updated;
}

/** Книга прошла проверку. */
export async function approveBook(book: ServerBook, actor: Actor): Promise<ServerBook | undefined> {
  if (book.reviewed) return book;
  const updated = await patchBook(String(book.id), { reviewed: true });
  await record(book, "approved", actor, { stateAfter: bookState({ ...book, reviewed: true }) });
  return updated;
}

/**
 * Автовосстановление: у скрытых книг, у которых срок скрытия истёк, снимаем скрытие,
 * пишем в журнал и уведомляем автора. Удалённые книги не трогаем (другое ограничение).
 * Безопасно вызывать часто — работает только если есть что восстанавливать.
 */
let sweeping: Promise<number> | null = null;
export function sweepExpiredHides(): Promise<number> {
  if (sweeping) return sweeping;
  const run = (async () => {
    const now = Date.now();
    const all = await getAllBooks({ includeHidden: true, includeDeleted: true });
    const expired = all.filter(
      (b) =>
        b.hidden &&
        !b.deleted &&
        b.hiddenUntil &&
        new Date(b.hiddenUntil).getTime() <= now,
    );
    let n = 0;
    for (const stale of expired) {
      // перечитываем: за это время книгу могли скрыть заново или удалить
      const b = await getBook(String(stale.id), { includeHidden: true, includeDeleted: true });
      if (!b || b.deleted || !b.hidden || !b.hiddenUntil) continue;
      if (new Date(b.hiddenUntil).getTime() > Date.now()) continue;
      await patchBook(String(b.id), clearHide());
      await record(b, "auto_published", SYSTEM_ACTOR, {
        reason: "Срок временного скрытия истёк",
        stateAfter: bookState({ ...b, hidden: false, hiddenUntil: null }),
      });
      n++;
    }
    return n;
  })().finally(() => {
    sweeping = null;
  });
  sweeping = run;
  return run;
}

/** Данные для карточки «Информация о книге» */
export async function bookInfo(book: ServerBook, forStaff: boolean) {
  const history = await historyFor(book.id);
  const state = bookState(book);
  const base = {
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description,
    coverUrl: book.coverUrl ?? null,
    gradient: book.gradient,
    category: book.category,
    genres: book.genres && book.genres.length ? book.genres : book.genre && book.genre !== "—" ? [book.genre] : [],
    publishedAt: book.createdAt ?? null,
    state,
    stateLabel: stateLabel(state, book.hiddenUntil),
    hiddenReason: state === "hidden" ? (book.hiddenReason ?? book.moderationNote ?? null) : null,
    hiddenUntil: state === "hidden" ? (book.hiddenUntil ?? null) : null,
    hiddenBy: state === "hidden" ? (book.hiddenBy ?? null) : null,
    deletedReason: book.deleted ? (book.deletedReason ?? null) : null,
    deletedAt: book.deleted ? (book.deletedAt ?? null) : null,
    deletedBy: book.deleted ? (book.deletedBy ?? null) : null,
    history,
  };
  if (!forStaff) return base;

  const authorId = await resolveUserId({ ownerId: book.ownerId, ownerName: book.owner });
  const author = authorId ? await findUserById(authorId) : undefined;
  return {
    ...base,
    admin: {
      authorId: authorId ?? null,
      authorName: author?.name ?? book.owner,
      authorEmail: author?.email ?? null,
      createdAt: book.createdAt ?? null,
      updatedAt: book.updatedAt ?? null,
      views: book.views ?? 0,
      reviewed: !!book.reviewed,
    },
  };
}

