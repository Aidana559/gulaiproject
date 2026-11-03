import { NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import { bad, forbidden, getActor, unauthorized } from "@/lib/server-auth";
import type { User } from "@/lib/types";

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return forbidden();
  const users = await readJson<User[]>("users.json", []);
  return NextResponse.json(
    users.map(({ password, passwordHash, ...safe }) => safe)
  );
}

export async function PATCH(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return forbidden();
  const { id, role, blocked } = await req.json();
  if (String(id) === String(actor.id)) return bad("Нельзя менять самого себя");

  const users = await readJson<User[]>("users.json", []);
  const u = users.find((x) => String(x.id) === String(id));
  if (!u) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (role !== undefined) {
    if (!["admin", "moderator", "user"].includes(role)) return bad("Неверная роль");
    u.role = role;
  }
  if (blocked !== undefined) u.blocked = !!blocked;
  await writeJson("users.json", users);
  return NextResponse.json({ ok: true });
}