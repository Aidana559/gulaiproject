import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
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
    return NextResponse.json({ error: "Атыңызды енгізіңіз (кемінде 2 таңба)" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email))
    return NextResponse.json({ error: "Email дұрыс емес" }, { status: 400 });
  if (password.length < 6)
    return NextResponse.json({ error: "Құпиясөз кемінде 6 таңба болуы керек" }, { status: 400 });

  if (await findUserByEmail(email))
    return NextResponse.json({ error: "Бұл email бұрын тіркелген" }, { status: 409 });

  const user = await createUser(name, email, password);
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions);
  return NextResponse.json({ user: toPublic(user) }, { status: 201 });
}