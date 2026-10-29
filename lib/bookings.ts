import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type BookingStatus = "reserved" | "borrowed" | "overdue" | "returned" | "cancelled";
export type BookingAction = "cancel" | "issue" | "return" | "extend";

export interface Booking {
  id: string;
  userId: string;
  bookId?: number;
  bookTitle: string;
  bookAuthor: string;
  status: BookingStatus;
  createdAt: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
}

const LOAN_DAYS = 14;
const FILE = path.join(process.cwd(), "data", "bookings.json");

const day = (d = new Date()) => d.toISOString().slice(0, 10);

function plusDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return day(d);
}

// Приводит старые записи к новому формату
function normalize(raw: Booking): Booking {
  const startDate = raw.startDate ?? raw.createdAt.slice(0, 10);
  const status = (raw.status as string) === "given" ? "borrowed" : raw.status;
  return {
    ...raw,
    status,
    startDate,
    dueDate: raw.dueDate ?? plusDays(startDate, LOAN_DAYS),
  };
}

// Для показа: просроченная выдача получает статус «Просрочена»
function view(b: Booking): Booking {
  return b.status === "borrowed" && b.dueDate < day() ? { ...b, status: "overdue" } : b;
}

async function readAll(): Promise<Booking[]> {
  try {
    const items = JSON.parse(await fs.readFile(FILE, "utf8")) as Booking[];
    return items.map(normalize);
  } catch {
    return [];
  }
}

async function writeAll(items: Booking[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function getBookingsByUser(userId: string) {
  const all = await readAll();
  return all
    .filter((b) => b.userId === userId)
    .map(view)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Книга занята, если на неё есть чья-то активная бронь или выдача
export async function isBookTaken(bookId: number) {
  const all = await readAll();
  return all.some((b) => b.bookId === bookId && (b.status === "reserved" || b.status === "borrowed"));
}

export async function createBooking(
  userId: string,
  bookTitle: string,
  bookAuthor: string,
  bookId?: number,
) {
  const all = await readAll();
  const today = day();
  const booking: Booking = {
    id: randomUUID(),
    userId,
    bookId,
    bookTitle,
    bookAuthor,
    status: "reserved",
    createdAt: new Date().toISOString(),
    startDate: today,
    dueDate: plusDays(today, LOAN_DAYS),
  };
  all.push(booking);
  await writeAll(all);
  return booking;
}

export async function applyAction(userId: string, id: string, action: BookingAction) {
  const all = await readAll();
  const idx = all.findIndex((b) => b.id === id && b.userId === userId);
  if (idx === -1) return null;

  const b = all[idx];
  const today = day();

  switch (action) {
    case "cancel":
      if (b.status !== "reserved") return null;
      b.status = "cancelled";
      break;
    case "issue":
      if (b.status !== "reserved") return null;
      b.status = "borrowed";
      b.startDate = today;
      b.dueDate = plusDays(today, LOAN_DAYS);
      break;
    case "return":
      if (b.status !== "borrowed") return null;
      b.status = "returned";
      break;
    case "extend":
      if (b.status !== "borrowed") return null;
      b.dueDate = plusDays(b.dueDate < today ? today : b.dueDate, 7);
      break;
  }

  await writeAll(all);
  return view(b);
}

// оставлено для совместимости со старым кодом
export const cancelBooking = (userId: string, id: string) => applyAction(userId, id, "cancel");