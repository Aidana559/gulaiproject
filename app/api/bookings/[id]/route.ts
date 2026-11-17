import { NextResponse } from "next/server";
import { getSessionUser, toPublic } from "@/lib/auth";
import { applyAction, deleteCancelledBookingForBorrower, type BookingAction } from "@/lib/bookings";

const ACTIONS: BookingAction[] = ["cancel", "issue", "return", "extend"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const action = (body?.action ?? "cancel") as BookingAction;

  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  }

  const actor = toPublic(user);
  const booking = await applyAction(
    { id: String(actor.id), name: actor.name, role: actor.role },
    id,
    action,
  );

  if (!booking) {
    return NextResponse.json(
      { error: "Действие недоступно или бронь не найдена" },
      { status: 403 },
    );
  }

  return NextResponse.json({ booking });
}

/** Permanently delete the current borrower's cancelled booking. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const { id } = await params;
  const deleted = await deleteCancelledBookingForBorrower(String(user.id), id);
  if (!deleted) return NextResponse.json({ error: "Удаление доступно только для своих отменённых броней" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
