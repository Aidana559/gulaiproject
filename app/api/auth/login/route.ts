import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  UsersStoreError,
  createSessionToken,
  findUserByEmail,
  sessionCookieOptions,
  toPublic,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  let user;
  try {
    user = await findUserByEmail(email);
  } catch (e) {
    if (!(e instanceof UsersStoreError)) throw e;
    // не путаем «хранилище не читается» с «неверный пароль»
    console.error(e);
    return NextResponse.json({ error: "Хранилище пользователей временно недоступно" }, { status: 503 });
  }
  if (!user || !verifyPassword(password, user.passwordHash))
    return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });

  if (user.blocked)
    return NextResponse.json({ error: "Аккаунт заблокирован администратором" }, { status: 403 });

  (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions);
  return NextResponse.json({ user: toPublic(user) });
}