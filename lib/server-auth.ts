import { NextResponse } from "next/server";
import { getSessionUser, toPublic } from "./auth";
import type { User } from "./types";

// Кто делает запрос: определяем по подписанной cookie сессии.
// Заголовкам от клиента (например, x-user-id) доверять нельзя: их может подставить кто угодно.
// Параметр req оставлен только для совместимости, чтобы не менять вызовы в API-роутах.
export async function getActor(_req?: Request): Promise<User | null> {
  const u = await getSessionUser(); // null для гостя и для заблокированного
  return u ? (toPublic(u) as User) : null; // без passwordHash
}

export const isStaff = (u: User) => u.role === "admin" || u.role === "moderator";

// Книга иесі: ownerId (id бойынша) немесе owner (аты бойынша)
export const isOwner = (book: any, u: User) =>
  (book.ownerId != null && String(book.ownerId) === String(u.id)) ||
  (book.owner != null && book.owner === u.name);

export const unauthorized = () =>
  NextResponse.json({ error: "Нужна авторизация" }, { status: 401 });
export const forbidden = () =>
  NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
export const bad = (msg: string) =>
  NextResponse.json({ error: msg }, { status: 400 });