import { NextResponse } from "next/server";
import { getSessionUser, toPublic } from "@/lib/auth";
import {
  createBooking,
  resolveBookOwner,
  getBookingsByUser,
  getBookStates,
  isBookTaken,
  listBookingsForActor,
} from "@/lib/bookings";
import { notify, resolveUserId } from "@/lib/notifications";

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

  if (searchParams.get("scope") === "mine") {
    // Добавляем обложку и градиент из каталога — профиль не знает всех книг сам
    const { getAllBooks } = await import("@/lib/books-store");
    const byId = new Map((await getAllBooks({ includeHidden: true })).map((b) => [String(b.id), b]));
    const mine = (await getBookingsByUser(user.id)).map((b) => {
      const k = byId.get(String(b.bookId));
      return { ...b, coverUrl: k?.coverUrl ?? null, gradient: k?.gradient };
    });
    return NextResponse.json({ bookings: mine.map((b) => ({
      ...b,
      isLibrary: byId.has(String(b.bookId)) && byId.get(String(b.bookId))?.ownerId == null,
      ownerId: byId.get(String(b.bookId))?.ownerId ?? null,
    })) });
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

  // Администратор и модератор не бронируют книги
  if (user.role === "admin" || user.role === "moderator") {
    return NextResponse.json(
      { error: "Администратор и модератор не могут бронировать книги" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const bookIdRaw = body?.bookId;
  const bookId = typeof bookIdRaw === "number" ? bookIdRaw : Number(bookIdRaw);

  if (!Number.isFinite(bookId)) {
    return NextResponse.json({ error: "bookId обязателен" }, { status: 400 });
  }


  let bookTitle = "";
  let bookAuthor = "";
  try {
    const { getBook, isPendingReview, isHiddenNow } = await import("@/lib/books-store");
    // includeHidden: true — чтобы отличить «на модерации» от «не найдено»
    const b = await getBook(String(bookId), { includeHidden: true });
    if (!b || b.deleted) {
      return NextResponse.json({ error: "Книга не найдена" }, { status: 404 });
    }
    if (isPendingReview(b)) {
      return NextResponse.json(
        { error: "Книга ещё на проверке модератора — бронировать нельзя" },
        { status: 409 },
      );
    }
    if (isHiddenNow(b)) {
      return NextResponse.json({ error: "Книга недоступна для бронирования" }, { status: 409 });
    }
    bookTitle = b.title;
    bookAuthor = b.author;
  } catch {
    /* ниже — «не найдена» */
  }
  if (!bookTitle) {
    return NextResponse.json({ error: "Книга не найдена" }, { status: 404 });
  }

  const owner = await resolveBookOwner(bookId);
  if (
    (owner.ownerId && String(owner.ownerId) === String(user.id)) ||
    (owner.ownerName && owner.ownerName === user.name)
  ) {
    return NextResponse.json(
      { error: "Нельзя бронировать собственную книгу" },
      { status: 403 },
    );
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
    await notify(await resolveUserId(owner), {
      type: "booking",
      text: `${user.name} забронировал(а) вашу книгу «${bookTitle}».`,
      href: "/transactions",
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Ошибка";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}