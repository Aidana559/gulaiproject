import { NextResponse } from "next/server";
import { getBookingsByUser } from "@/lib/bookings";
import { deleteNotifications, listFor, markRead, notify } from "@/lib/notifications";
import { bad, getActor, unauthorized } from "@/lib/server-auth";
import { sweepExpiredHides } from "@/lib/moderation";

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

  await sweepExpiredHides().catch(() => 0);
  await ensureDueReminders(String(actor.id));
  const items = await listFor(String(actor.id));
  const params = new URL(req.url).searchParams;

  const unreadItems = items.filter((n) => !n.read);
  const counts: Record<string, number> = {};
  for (const n of unreadItems) counts[n.type] = (counts[n.type] ?? 0) + 1;

  // unread=1 — выпадающий список колокольчика: только непрочитанные
  // all=1 — полная история (страница /notifications): и прочитанные, и новые
  const list = params.get("unread") === "1" ? unreadItems.slice(0, 50) : params.get("all") === "1" ? items : items.slice(0, 30);
  return NextResponse.json(
    { items: list, unread: unreadItems.length, counts, total: items.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}

type Body = { id?: string; ids?: string[]; all?: boolean; allRead?: boolean; types?: string[] };

export async function PATCH(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  const { id, ids, all, types } = (await req.json().catch(() => ({}))) as Body;
  const idList = Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
  if (!id && !idList.length && !all) return bad("Нужен id, ids или all");

  await markRead(String(actor.id), { id, ids: idList, all: !!all, types });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  const { ids, allRead, types } = (await req.json().catch(() => ({}))) as Body;
  const idList = Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
  if (!idList.length && !allRead) return bad("Нужен ids или allRead");

  const removed = await deleteNotifications(String(actor.id), { ids: idList, allRead: !!allRead, types });
  return NextResponse.json({ ok: true, removed });
}
