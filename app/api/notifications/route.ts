import { NextResponse } from "next/server";
import { getBookingsByUser } from "@/lib/bookings";
import { listFor, markRead, notify } from "@/lib/notifications";
import { bad, getActor, unauthorized } from "@/lib/server-auth";

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

/** Напоминания о сроке возврата — создаём при обращении, повторно (по key) не дублируются. */
async function ensureDueReminders(userId: string) {
  const today = dayStr(new Date());
  const tomorrow = dayStr(new Date(Date.now() + 86_400_000));
  const mine = await getBookingsByUser(userId);

  for (const b of mine) {
    if (b.status !== "borrowed" && b.status !== "overdue") continue;
    const base = { type: "return" as const, href: "/transactions" };
    if (b.status === "overdue") {
      await notify(userId, {
        ...base,
        text: `Срок возврата книги «${b.bookTitle}» истёк (${b.dueDate}). Верните её владельцу.`,
        key: `due:${b.id}:${b.dueDate}:overdue`,
      });
    } else if (b.dueDate === today) {
      await notify(userId, {
        ...base,
        text: `Сегодня последний день, чтобы вернуть «${b.bookTitle}».`,
        key: `due:${b.id}:${b.dueDate}:today`,
      });
    } else if (b.dueDate === tomorrow) {
      await notify(userId, {
        ...base,
        text: `Срок возврата книги «${b.bookTitle}» — завтра.`,
        key: `due:${b.id}:${b.dueDate}:tomorrow`,
      });
    }
  }
}

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  await ensureDueReminders(String(actor.id));
  const items = await listFor(String(actor.id));
  return NextResponse.json(
    { items: items.slice(0, 30), unread: items.filter((n) => !n.read).length },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { id, all } = body as { id?: string; all?: boolean };
  if (!id && !all) return bad("Нужен id или all");

  await markRead(String(actor.id), { id, all: !!all });
  return NextResponse.json({ ok: true });
}