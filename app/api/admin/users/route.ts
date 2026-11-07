import { NextResponse } from "next/server";
import {
  deleteUser,
  findUserById,
  listUsers,
  toPublic,
  updateUser,
  type Role,
} from "@/lib/auth";
import { forbidden, getActor, isStaff, unauthorized, bad } from "@/lib/server-auth";

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin" && actor.role !== "moderator") return forbidden();

  const users = await listUsers();

  return NextResponse.json({
    users: users.map((u) => toPublic(u)),
  });
}

export async function PATCH(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { id, role, blocked, muted, muteDays, muteReason } = body as {
    id?: string;
    role?: Role;
    blocked?: boolean;
    muted?: boolean;
   
    muteDays?: number | null;
    muteReason?: string;
  };

  if (!id) return bad("Нет id пользователя");


  if (role !== undefined || blocked !== undefined) {
    if (actor.role !== "admin") return forbidden();
  }
  if (muted !== undefined) {
    if (!isStaff(actor)) return forbidden();
  }

  if (String(id) === String(actor.id) && (blocked === true || muted === true)) {
    return bad("Нельзя заблокировать или замьютить себя");
  }

  
  if (muted !== undefined && actor.role === "moderator") {
    const target = await findUserById(id);
    if (!target) return NextResponse.json({ error: "Не найден" }, { status: 404 });
    if (target.role !== "user") return forbidden();
  }

  const patch: {
    role?: Role;
    blocked?: boolean;
    muted?: boolean;
    mutedUntil?: string;
    muteReason?: string;
  } = {};
  if (role !== undefined) {
    if (!["admin", "moderator", "user"].includes(role)) return bad("Неверная роль");
    patch.role = role;
  }
  if (blocked !== undefined) patch.blocked = !!blocked;
  if (muted === true) {
    patch.muted = true;
    const days = Math.min(Number(muteDays), 365);
    patch.mutedUntil =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * 86_400_000).toISOString()
        : undefined; 
    patch.muteReason = String(muteReason ?? "").trim().slice(0, 300) || undefined;
  } else if (muted === false) {
    patch.muted = false;
    patch.mutedUntil = undefined;
    patch.muteReason = undefined;
  }

  const updated = await updateUser(id, patch);
  if (!updated) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  return NextResponse.json({ user: toPublic(updated) });
}

export async function DELETE(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return forbidden();

  const body = await req.json().catch(() => ({}));
  const id = String((body as { id?: string }).id ?? "");
  if (!id) return bad("Нет id пользователя");
  if (id === String(actor.id)) return bad("Нельзя удалить самого себя");

  const target = await findUserById(id);
  if (!target) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  if (target.role === "admin") {
    const admins = (await listUsers()).filter((u) => u.role === "admin");
    if (admins.length <= 1) return bad("Нельзя удалить последнего администратора");
  }

  await deleteUser(id);
  return NextResponse.json({ ok: true });
}