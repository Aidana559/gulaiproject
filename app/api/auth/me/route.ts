import { NextResponse } from "next/server";
import { getSessionUser, toPublic, updateUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser(); // null для гостя и для заблокированного
  if (!user) return NextResponse.json({ error: "Вы не вошли в систему" }, { status: 401 });
  return NextResponse.json({ user: toPublic(user) });
}

// Профильдегі атты серверде сақтайды: брондар мен транзакциялар осы аттан алады
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Вы не вошли в систему" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 30) {
    return NextResponse.json({ error: "От 2 до 30 символов" }, { status: 400 });
  }
  const updated = await updateUser(String(user.id), { name });
  if (!updated) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  return NextResponse.json({ user: toPublic(updated) });
}
