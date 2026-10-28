import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, findUserById, readSessionToken, toPublic } from "@/lib/auth";

export async function GET() {
  const uid = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const user = uid ? await findUserById(uid) : undefined;
  if (!user) return NextResponse.json({ error: "Кірмегенсіз" }, { status: 401 });
  return NextResponse.json({ user: toPublic(user) });
}