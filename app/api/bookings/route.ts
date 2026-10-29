import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createBooking, getBookingsByUser } from "@/lib/bookings";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  return NextResponse.json({ bookings: await getBookingsByUser(user.id) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bookTitle = String(body?.bookTitle ?? "").trim();
  const bookAuthor = String(body?.bookAuthor ?? "").trim();
  if (!bookTitle)
    return NextResponse.json({ error: "Укажите название книги" }, { status: 400 });

  const booking = await createBooking(user.id, bookTitle, bookAuthor);
  return NextResponse.json({ booking }, { status: 201 });
}