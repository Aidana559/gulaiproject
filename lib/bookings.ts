import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type BookingStatus = "reserved" | "given" | "cancelled";

export interface Booking {
  id: string;
  userId: string;
  bookTitle: string;
  bookAuthor: string;
  status: BookingStatus;
  createdAt: string;
}

const FILE = path.join(process.cwd(), "data", "bookings.json");

async function readAll(): Promise<Booking[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Booking[];
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
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createBooking(userId: string, bookTitle: string, bookAuthor: string) {
  const all = await readAll();
  const booking: Booking = {
    id: randomUUID(),
    userId,
    bookTitle,
    bookAuthor,
    status: "reserved",
    createdAt: new Date().toISOString(),
  };
  all.push(booking);
  await writeAll(all);
  return booking;
}

export async function cancelBooking(userId: string, id: string) {
  const all = await readAll();
  const booking = all.find((b) => b.id === id && b.userId === userId);
  if (!booking || booking.status !== "reserved") return null;
  booking.status = "cancelled";
  await writeAll(all);
  return booking;
}