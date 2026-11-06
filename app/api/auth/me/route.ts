import { NextResponse } from "next/server";
import { getSessionUser, toPublic } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser(); // null для гостя и для заблокированного
  if (!user) return NextResponse.json({ error: "Вы не вошли в систему" }, { status: 401 });
  return NextResponse.json({ user: toPublic(user) });
}
