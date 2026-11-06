import { NextResponse } from "next/server";
import { getSessionUser, toPublic } from "@/lib/auth";
import {
  createBooking,
  getBookingsByUser,
  getBookStates,
  isBookTaken,
  listBookingsForActor,
} from "@/lib/bookings";
import { getBook as getStaticBook } from "@/data/books";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("states")) {
    return NextResponse.json(
      { states: await getBookStates() },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  // scope=mine — только свои брони (профиль)
  // иначе — для страницы транзакций (свои + заявки на мои книги / все для админа)
  if (searchParams.get("scope") === "mine") {
    return NextResponse.json({ bookings: await getBookingsByUser(user.id) });
  }

  const actor = toPublic(user);
  const bookings = await listBookingsForActor({
    id: String(actor.id),
    name: actor.name,
    role: actor.role,
  });
  return NextResponse.json({ bookings });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bookIdRaw = body?.bookId;
  const bookId = typeof bookIdRaw === "number" ? bookIdRaw : Number(bookIdRaw);

  if (!Number.isFinite(bookId)) {
    return NextResponse.json({ error: "bookId обязателен" }, { status: 400 });
  }

  // книга: сначала books-store (если есть), иначе статика
  let bookTitle = "";
  let bookAuthor = "";
  try {
    const { getBook } = await import("@/lib/books-store");
    const b = await getBook(String(bookId));
    if (b && !b.deleted) {
      bookTitle = b.title;
      bookAuthor = b.author;
    }
  } catch {
    /* */
  }
  if (!bookTitle) {
    const s = getStaticBook(bookId);
    if (!s) return NextResponse.json({ error: "Книга не найдена" }, { status: 404 });
    bookTitle = s.title;
    bookAuthor = s.author;
  }

  if (await isBookTaken(bookId)) {
    return NextResponse.json({ error: "Эта книга уже забронирована" }, { status: 409 });
  }

  try {
    const booking = await createBooking({
      userId: user.id,
      userName: user.name,
      bookId,
      bookTitle,
      bookAuthor,
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Ошибка";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
