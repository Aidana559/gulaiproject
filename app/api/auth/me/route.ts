import { NextResponse } from "next/server";
import { getSessionUser, toPublic, updateUser, EmailTakenError, UsersStoreError, type User } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Вы не вошли в систему" }, { status: 401 });
  return NextResponse.json({ user: toPublic(user) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Вы не вошли в систему" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const invalid = (error: string) => NextResponse.json({ error }, { status: 400 });
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalid("Некорректные данные");
  const patch: Partial<Pick<User, "name" | "email" | "bio" | "avatar" | "telegram">> = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 30) return invalid("Имя: от 2 до 30 символов");
    patch.name = body.name.trim();
  }
  if ("email" in body) {
    if (typeof body.email !== "string" || body.email.length > 254 || !/^\S+@\S+\.\S+$/.test(body.email.trim())) return invalid("Некорректная почта");
    patch.email = body.email.trim().toLowerCase();
  }
  if ("bio" in body) {
    if (typeof body.bio !== "string" || body.bio.length > 200) return invalid("Описание: не более 200 символов");
    patch.bio = body.bio.trim();
  }
  if ("telegram" in body) {
    if (typeof body.telegram !== "string" || (body.telegram.trim() && !/^@?[a-zA-Z0-9_]{4,32}$/.test(body.telegram.trim()))) return invalid("Некорректный Telegram");
    patch.telegram = body.telegram.trim();
  }
  if ("avatar" in body) {
    if (body.avatar !== null && (typeof body.avatar !== "string" || body.avatar.length > 350000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.avatar))) return invalid("Некорректный аватар");
    patch.avatar = body.avatar;
  }
  if (!Object.keys(patch).length) return invalid("Нет изменений");
  try {
    const updated = await updateUser(String(user.id), patch);
    if (!updated) return NextResponse.json({ error: "Профиль недоступен" }, { status: 403 });
    return NextResponse.json({ user: toPublic(updated) });
  } catch (e) {
    if (e instanceof EmailTakenError) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e instanceof UsersStoreError) return NextResponse.json({ error: "Хранилище временно недоступно" }, { status: 503 });
    throw e;
  }
}
