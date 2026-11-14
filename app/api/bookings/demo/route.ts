import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { writeDemoState, type DemoTx } from "@/lib/bookings";

const STATUSES = new Set(["reserved", "confirmed", "borrowed", "overdue", "returned", "cancelled"]);

/** Клиент присылает актуальный список демо-транзакций, чтобы каталог считал статусы так же, как «Транзакции». */
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items = body?.items;
  if (!Array.isArray(items) || items.length > 500) {
    return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
  }

  const clean: DemoTx[] = [];
  for (const t of items) {
    if (
      !t ||
      typeof t.id !== "number" ||
      !Number.isFinite(Number(t.bookId)) ||
      typeof t.person !== "string" ||
      !STATUSES.has(t.status)
    ) {
      return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
    }
    clean.push({
      id: t.id,
      bookId: Number(t.bookId),
      person: t.person,
      status: t.status,
      startDate: String(t.startDate ?? ""),
      dueDate: String(t.dueDate ?? ""),
    });
  }

  await writeDemoState(clean);
  return NextResponse.json({ ok: true });
}
