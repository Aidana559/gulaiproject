import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createBooking, getBookingsByUser, isBookTaken } from "@/lib/bookings";
import { getBook } from "@/data/books";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  return NextResponse.json({ bookings: await getBookingsByUser(user.id) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => null);
  let bookTitle = String(body?.bookTitle ?? "").trim();
  let bookAuthor = String(body?.bookAuthor ?? "").trim();
  let bookId: number | undefined;

  if (typeof body?.bookId === "number") {
    const book = getBook(body.bookId);
    if (!book) return NextResponse.json({ error: "Книга не найдена" }, { status: 404 });
    if (await isBookTaken(book.id)) {
      return NextResponse.json({ error: "Эта книга уже забронирована" }, { status: 409 });
    }
    bookId = book.id;
    bookTitle = book.title;
    bookAuthor = book.author;
  }

  if (!bookTitle) return NextResponse.json({ error: "Укажите название книги" }, { status: 400 });

  const booking = await createBooking(user.id, bookTitle, bookAuthor, bookId);
  return NextResponse.json({ booking }, { status: 201 });
}