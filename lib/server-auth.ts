import { NextResponse } from "next/server";
import { readJson } from "./db";
import type { User } from "./types";

export async function getActor(req: Request): Promise<User | null> {
  const id = req.headers.get("x-user-id");
  if (!id) return null;
  const users = await readJson<User[]>("users.json", []);
  const u = users.find((x) => String(x.id) === id);
  return u && !u.blocked ? u : null;
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