import { NextResponse } from "next/server";
import { getPublicProfile } from "@/lib/public-profile";
import { canViewPublicProfiles } from "@/lib/profile-access";
import { forbidden, getActor, unauthorized } from "@/lib/server-auth";
import { UsersStoreError } from "@/lib/users-store";

/**
 * Публичный профиль пользователя: имя, рейтинг, одобренные публичные книги с живыми статусами.
 * Доступен только вошедшему `user` (роль берётся из подписанной cookie сессии);
 * профиль есть только у пользователей с ролью `user`. Личные данные не отдаются.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (!canViewPublicProfiles(actor.role)) return forbidden();

  const { id } = await params;
  try {
    const profile = await getPublicProfile(String(id));
    if (!profile) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    return NextResponse.json(profile, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (!(e instanceof UsersStoreError)) throw e;
    console.error(e);
    return NextResponse.json({ error: "Хранилище пользователей временно недоступно" }, { status: 503 });
  }
}
