import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "path";
import { books as staticBooks } from "@/data/books";
import demoTx from "@/data/transactions.json";
import { notify, resolveUserId } from "@/lib/notifications";

export type BookingStatus =
  | "reserved"
  | "borrowed"
  | "returned"
  | "cancelled"
  | "overdue";

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
  returnedAt?: string;
}

export type BookingView = Omit<Booking, "status"> & {
  status: BookingStatus;
  reliability?: Reliability;
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
  if (raw.bookId == null || Number.isNaN(Number(raw.bookId))) return null;

  let status = raw.status as string;
  if (status === "given") status = "borrowed";
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
    returnedAt: raw.returnedAt,
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

export async function listBookingsForActor(actor: {
  id: string;
  name: string;
  role?: string;
}): Promise<BookingView[]> {
  const all = await readAll();
  const result: BookingView[] = [];
  const reliabilityCache = new Map<string, Reliability>();
  for (const b of all) {
    const owner = await resolveBookOwner(b.bookId);
    const isBorrower = String(b.userId) === String(actor.id);
    const isMgr = canManageBook(actor, owner);

    // Видят только участники брони: читатель, владелец книги, админ/модератор.
    if (!isBorrower && !isMgr) continue;

    result.push({
      ...b,
      status: viewStatus(b),
      allowedActions: allowedActionsFor(b, actor, owner),
      reliability: reliabilityFor(all, reliabilityCache, b.userId, b.userName),
    });
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function isBookTaken(bookId: number) {
  const all = await readAll();
  return all.some((b) => isActive(b) && b.bookId === bookId);
}

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
      b.returnedAt = today;
      break;
    case "extend":
      b.dueDate = plusDays(b.dueDate < today ? today : b.dueDate, 7);
      break;
  }

  await writeAll(all);

  const ownerUserId = await resolveUserId(owner);
  const byBorrower = String(b.userId) === String(actor.id);
  const title = `«${b.bookTitle}»`;
  switch (action) {
    case "cancel":
      if (byBorrower) {
        await notify(ownerUserId, {
          type: "booking",
          text: `${b.userName ?? "Читатель"} отменил(а) бронь книги ${title}.`,
          href: "/transactions",
        });
      } else {
        await notify(b.userId, {
          type: "booking",
          text: `Бронь книги ${title} отменена владельцем.`,
          href: "/transactions",
        });
      }
      break;
    case "issue":
      await notify(b.userId, {
        type: "booking",
        text: `Книга ${title} выдана вам. Вернуть нужно до ${b.dueDate}.`,
        href: "/transactions",
      });
      break;
    case "return":
      await notify(b.userId, {
        type: "booking",
        text: `Возврат книги ${title} принят. Спасибо!`,
        href: "/transactions",
      });
      break;
    case "extend":
      await notify(b.userId, {
        type: "return",
        text: `Срок возврата книги ${title} продлён до ${b.dueDate}.`,
        href: "/transactions",
      });
      break;
  }

  return {
    ...b,
    status: viewStatus(b),
    allowedActions: allowedActionsFor(b, actor, owner),
  };
}

export const cancelBooking = (actor: { id: string; name: string; role?: string }, id: string) =>
  applyAction(actor, id, "cancel");


export type Reliability = {
  onTime: number;
  late: number;
  notReturned: number;
  total: number;
  percent: number | null;
};

type DemoTx = {
  id: number;
  bookId: number;
  person: string;
  status: string;
  startDate: string;
  dueDate: string;
};

const demo = demoTx as DemoTx[];

type Loan = { status: string; dueDate: string; returnedAt?: string };

function summarize(loans: Loan[]): Reliability {
  const today = day();
  let onTime = 0;
  let late = 0;
  let notReturned = 0;
  for (const l of loans) {
    if (l.status === "returned") {
      if (!l.returnedAt || l.returnedAt <= l.dueDate) onTime++;
      else late++;
    } else if (l.status === "overdue" || (l.status === "borrowed" && l.dueDate < today)) {
      notReturned++;
    }
  }
  const total = onTime + late + notReturned;
  return {
    onTime,
    late,
    notReturned,
    total,
    percent: total ? Math.round((onTime / total) * 100) : null,
  };
}

function reliabilityFor(
  all: Booking[],
  cache: Map<string, Reliability>,
  userId?: string,
  name?: string,
): Reliability {
  const key = `${userId ?? ""}|${name ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const loans: Loan[] = all.filter((b) => userId && String(b.userId) === String(userId));
  if (!userId && name) loans.push(...demo.filter((d) => d.person === name));
  const r = summarize(loans);
  cache.set(key, r);
  return r;
}

export async function getReliability(userId?: string, name?: string): Promise<Reliability> {
  return reliabilityFor(await readAll(), new Map(), userId, name);
}

export type Borrower = {
  key: string;
  userId?: string;
  name: string;
  status: BookingStatus;
  startDate: string;
  dueDate: string;
  returnedAt?: string;
  reliability: Reliability;
};

export async function getBookBorrowers(bookId: number): Promise<Borrower[]> {
  const all = await readAll();
  const cache = new Map<string, Reliability>();

  const fromServer: Borrower[] = all
    .filter((b) => b.bookId === bookId && b.status !== "cancelled")
    .map((b) => ({
      key: b.id,
      userId: b.userId,
      name: b.userName || "Читатель",
      status: viewStatus(b),
      startDate: b.startDate,
      dueDate: b.dueDate,
      returnedAt: b.returnedAt,
      reliability: reliabilityFor(all, cache, b.userId, b.userName),
    }));

  const fromDemo: Borrower[] = demo
    .filter((d) => d.bookId === bookId && d.status !== "cancelled")
    .map((d) => ({
      key: `demo-${d.id}`,
      name: d.person,
      status: (d.status === "borrowed" && d.dueDate < day() ? "overdue" : d.status) as BookingStatus,
      startDate: d.startDate,
      dueDate: d.dueDate,
      reliability: reliabilityFor(all, cache, undefined, d.person),
    }));

  return [...fromServer, ...fromDemo].sort((a, b) => b.startDate.localeCompare(a.startDate));
}