import { NextResponse } from "next/server";
import { listUsers } from "@/lib/auth";
import { checkChatAccess } from "@/lib/chatAccess";
import { forbidden, getActor, unauthorized } from "@/lib/server-auth";

/**
 * Справочник собеседников для чатов: id и имена пользователей с ролью `user`.
 * Нужен клиентскому хранилищу, чтобы проверить роль собеседника при создании
 * диалога и отправке сообщения. Отдаётся только вошедшему `user`;
 * admin и moderator получают 403. Роль берётся из подписанной cookie сессии.
 */
export async function GET() {
  const actor = await getActor();
  if (!actor) return unauthorized();
  const decision = checkChatAccess({ id: String(actor.id), name: actor.name, role: actor.role });
  if (!decision.ok) return forbidden();

  const users = (await listUsers())
    .filter((u) => u.role === "user" && !u.blocked)
    .map((u) => ({ id: String(u.id), name: u.name }));

  return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
}
