import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { cancelBooking } from "@/lib/bookings";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { id } = await params;
  const booking = await cancelBooking(user.id, id);
  if (!booking)
    return NextResponse.json({ error: "Бронь не найдена или уже не активна" }, { status: 404 });
  return NextResponse.json({ booking });
}