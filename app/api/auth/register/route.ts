import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  EmailTakenError,
  SESSION_COOKIE,
  UsersStoreError,
  createSessionToken,
  createUser,
  findUserByEmail,
  sessionCookieOptions,
  toPublic,
} from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (name.length < 2)
    return NextResponse.json({ error: "Введите ваше имя (минимум 2 символа)" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email))
    return NextResponse.json({ error: "Некорректный Email" }, { status: 400 });
  if (password.length < 6)
    return NextResponse.json({ error: "Пароль должен содержать минимум 6 символов" }, { status: 400 });

  try {
    if (await findUserByEmail(email))
      return NextResponse.json({ error: "Этот email уже зарегистрирован" }, { status: 409 });

    // повторная проверка email выполняется внутри createUser под блокировкой (защита от двойной отправки формы)
    const user = await createUser(name, email, password);
    (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions);
    return NextResponse.json({ user: toPublic(user) }, { status: 201 });
  } catch (e) {
    if (e instanceof EmailTakenError)
      return NextResponse.json({ error: "Этот email уже зарегистрирован" }, { status: 409 });
    if (e instanceof UsersStoreError) {
      console.error(e);
      return NextResponse.json({ error: "Хранилище пользователей временно недоступно" }, { status: 503 });
    }
    throw e;
  }
}