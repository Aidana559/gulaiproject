import { NextResponse } from "next/server";
import { listUsers, toPublic, updateUser, type Role } from "@/lib/auth";
import { forbidden, getActor, isStaff, unauthorized, bad } from "@/lib/server-auth";

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin" && actor.role !== "moderator") return forbidden();

  const users = await listUsers();
  // модератору не отдаём passwordHash (toPublic) и можно скрыть email админов при желании
  return NextResponse.json({
    users: users.map((u) => toPublic(u)),
  });
}

export async function PATCH(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { id, role, blocked, muted } = body as {
    id?: string;
    role?: Role;
    blocked?: boolean;
    muted?: boolean;
  };

  if (!id) return bad("Нет id пользователя");

  // mute — модератор и админ; role/blocked — только админ
  if (role !== undefined || blocked !== undefined) {
    if (actor.role !== "admin") return forbidden();
  }
  if (muted !== undefined) {
    if (!isStaff(actor)) return forbidden();
  }

  if (String(id) === String(actor.id) && (blocked === true || muted === true)) {
    return bad("Нельзя заблокировать или замьютить себя");
  }

  const patch: { role?: Role; blocked?: boolean; muted?: boolean } = {};
  if (role !== undefined) {
    if (!["admin", "moderator", "user"].includes(role)) return bad("Неверная роль");
    patch.role = role;
  }
  if (blocked !== undefined) patch.blocked = !!blocked;
  if (muted !== undefined) patch.muted = !!muted;

  const updated = await updateUser(id, patch);
  if (!updated) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  return NextResponse.json({ user: toPublic(updated) });
}
