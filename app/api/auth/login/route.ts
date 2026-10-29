import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
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

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash))
    return NextResponse.json({ error: "Email немесе құпиясөз қате" }, { status: 401 });

  (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions);
  return NextResponse.json({ user: toPublic(user) });
}