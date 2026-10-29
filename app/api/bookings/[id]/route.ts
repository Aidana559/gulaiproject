import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { applyAction, type BookingAction } from "@/lib/bookings";

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

  const booking = await applyAction(user.id, id, action);
  if (!booking) return NextResponse.json({ error: "Действие недоступно" }, { status: 400 });
  return NextResponse.json({ booking });
}