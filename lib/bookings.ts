import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "path";
import { books as staticBooks } from "@/data/books";

/**
 * Цепочка: reserved → borrowed → returned
 * + cancelled. overdue — только для отображения (borrowed + dueDate < today).
 */
export type BookingStatus =
  | "reserved"
  | "borrowed"
  | "returned"
  | "cancelled"
  | "overdue"; // только view

export type BookingAction = "cancel" | "issue" | "return" | "extend";

export interface Booking {
  id: string;
  userId: string;
  userName?: string;
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
  status: Exclude<BookingStatus, "overdue">;
  createdAt: string;
  startDate: string;
  dueDate: string;
}

export type BookingView = Booking & {
  status: BookingStatus;
  /** кнопки, которые можно показать текущему пользователю */
  allowedActions?: BookingAction[];
};

const LOAN_DAYS = 14;
const FILE = path.join(process.cwd(), "data", "bookings.json");

const day = (d = new Date()) => d.toISOString().slice(0, 10);

function plusDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return day(d);
}

function normalize(raw: Booking & { bookId?: number }): Booking | null {
  // без bookId — мусор (типа «Grammar»), выкидываем при чтении
  if (raw.bookId == null || Number.isNaN(Number(raw.bookId))) return null;

  let status = raw.status as string;
  if (status === "given") status = "borrowed";
  // шаг «подтверждение» убран: старые confirmed считаем обычной бронью
  if (status === "confirmed") status = "reserved";
  if (!["reserved", "borrowed", "returned", "cancelled"].includes(status)) {
    status = "reserved";
  }

  const startDate = raw.startDate ?? raw.createdAt?.slice(0, 10) ?? day();
  return {
    id: raw.id,
    userId: raw.userId,
    userName: raw.userName,
    bookId: Number(raw.bookId),
    bookTitle: raw.bookTitle,
    bookAuthor: raw.bookAuthor ?? "",
    status: status as Booking["status"],
    createdAt: raw.createdAt ?? new Date().toISOString(),
    startDate,
    dueDate: raw.dueDate ?? plusDays(startDate, LOAN_DAYS),
  };
}

function viewStatus(b: Booking): BookingStatus {
  if (b.status === "borrowed" && b.dueDate < day()) return "overdue";
  return b.status;
}

const isActive = (b: Booking) =>
  b.status === "reserved" || b.status === "borrowed";

async function readAll(): Promise<Booking[]> {
  try {
    const items = JSON.parse(await fs.readFile(FILE, "utf8")) as unknown[];
    const out: Booking[] = [];
    for (const raw of items) {
      const n = normalize(raw as Booking);
      if (n) out.push(n);
    }
    // одноразовая чистка файла от записей без bookId
    if (out.length !== items.length) await writeAll(out);
    return out;
  } catch {
    return [];
  }
}

async function writeAll(items: Booking[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

/** владелец книги: ownerId или имя owner из статики / user-books */
export async function resolveBookOwner(bookId: number): Promise<{
  ownerId?: string;
  ownerName?: string;
}> {
  try {
    const { getBook } = await import("@/lib/books-store");
    const b = await getBook(String(bookId), { includeHidden: true });
    if (b) {
      return {
        ownerId: b.ownerId != null ? String(b.ownerId) : undefined,
        ownerName: b.owner,
      };
    }
  } catch {
    /* books-store может ещё не быть */
  }
  const s = staticBooks.find((x) => x.id === bookId);
  return s ? { ownerName: s.owner } : {};
}

function canManageBook(
  actor: { id: string; name: string; role?: string },
  owner: { ownerId?: string; ownerName?: string },
) {
  if (actor.role === "admin" || actor.role === "moderator") return true;
  if (owner.ownerId && String(owner.ownerId) === String(actor.id)) return true;
  if (owner.ownerName && owner.ownerName === actor.name) return true;
  return false;
}

export function allowedActionsFor(
  b: Booking,
  actor: { id: string; name: string; role?: string } | null,
  owner: { ownerId?: string; ownerName?: string },
): BookingAction[] {
  if (!actor) return [];
  const actions: BookingAction[] = [];
  const isBorrower = String(b.userId) === String(actor.id);
  const isMgr = canManageBook(actor, owner);
  const st = b.status;

  // бронь: выдать и отменить (читатель — свою, владелец/админ — любую)
  if ((isBorrower || isMgr) && st === "reserved") {
    if (isMgr) actions.push("issue");
    actions.push("cancel");
  }
  if (isMgr && st === "borrowed") {
    actions.push("return");
    actions.push("extend");
  }
  return actions;
}

export async function getBookingsByUser(userId: string) {
  const all = await readAll();
  return all
    .filter((b) => b.userId === userId)
    .map((b) => ({ ...b, status: viewStatus(b) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Для страницы «Транзакции»: админ — все; иначе свои брони + заявки на свои книги */
export async function listBookingsForActor(actor: {
  id: string;
  name: string;
  role?: string;
}): Promise<BookingView[]> {
  const all = await readAll();
  const isAdmin = actor.role === "admin";

  const result: BookingView[] = [];
  for (const b of all) {
    const owner = await resolveBookOwner(b.bookId);
    const isBorrower = String(b.userId) === String(actor.id);
    const isMgr = canManageBook(actor, owner);
    // Показываем транзакции всех пользователей; allowedActions по-прежнему ограничивает управление.

    result.push({
      ...b,
      status: viewStatus(b),
      allowedActions: allowedActionsFor(b, actor, owner),
    });
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function isBookTaken(bookId: number) {
  const all = await readAll();
  return all.some((b) => isActive(b) && b.bookId === bookId);
}

/** { "3": "reserved" | "given" } для бейджей каталога */
export async function getBookStates() {
  const all = await readAll();
  const states: Record<string, "reserved" | "given"> = {};
  for (const b of all) {
    if (!isActive(b)) continue;
    const key = String(b.bookId);
    if (states[key] === "given") continue;
    if (b.status === "borrowed") states[key] = "given";
    else states[key] = "reserved";
  }
  return states;
}

export async function createBooking(input: {
  userId: string;
  userName?: string;
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
}) {
  if (input.bookId == null || Number.isNaN(Number(input.bookId))) {
    throw new Error("bookId обязателен");
  }
  if (await isBookTaken(input.bookId)) {
    throw new Error("Эта книга уже забронирована");
  }

  const all = await readAll();
  const today = day();
  const booking: Booking = {
    id: randomUUID(),
    userId: input.userId,
    userName: input.userName,
    bookId: Number(input.bookId),
    bookTitle: input.bookTitle,
    bookAuthor: input.bookAuthor,
    status: "reserved",
    createdAt: new Date().toISOString(),
    startDate: today,
    dueDate: plusDays(today, LOAN_DAYS),
  };
  all.push(booking);
  await writeAll(all);
  return booking;
}

export async function applyAction(
  actor: { id: string; name: string; role?: string },
  id: string,
  action: BookingAction,
): Promise<BookingView | null> {
  const all = await readAll();
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) return null;

  const b = all[idx];
  const owner = await resolveBookOwner(b.bookId);
  const allowed = allowedActionsFor(b, actor, owner);
  if (!allowed.includes(action)) return null;

  const today = day();

  switch (action) {
    case "cancel":
      b.status = "cancelled";
      break;
    case "issue":
      b.status = "borrowed";
      b.startDate = today;
      b.dueDate = plusDays(today, LOAN_DAYS);
      break;
    case "return":
      b.status = "returned";
      break;
    case "extend":
      b.dueDate = plusDays(b.dueDate < today ? today : b.dueDate, 7);
      break;
  }

  await writeAll(all);
  return {
    ...b,
    status: viewStatus(b),
    allowedActions: allowedActionsFor(b, actor, owner),
  };
}

export const cancelBooking = (actor: { id: string; name: string; role?: string }, id: string) =>
  applyAction(actor, id, "cancel");
