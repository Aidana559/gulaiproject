import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { cookies } from "next/headers";
import { UsersStoreError, findUserById, insertUser } from "./users-store";

export { EmailTakenError, UsersStoreError, deleteUser, findUserByEmail, findUserById, listUsers, updateUser } from "./users-store";

export type Role = "admin" | "moderator" | "user";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  blocked?: boolean;
  muted?: boolean;
  mutedUntil?: string;
  muteReason?: string;
}

export type PublicUser = Omit<User, "passwordHash">;

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const SECRET =
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "production"
    ? (() => { throw new Error("AUTH_SECRET не задан"); })()
    : "dev-secret-change-me");

/** Хранение пользователей — в lib/users-store.ts (атомарная запись, блокировка, уникальный email). */
export async function createUser(name: string, email: string, password: string) {
  return insertUser({ name, email, passwordHash: hashPassword(password) });
}

export function toPublic(user: User): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  void _omit;
  return rest;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(value: string) {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + SESSION_MAX_AGE * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.uid !== "string" || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export async function getSessionUser() {
  const uid = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  try {
    const user = await findUserById(uid);
    return user && !user.blocked ? user : null;
  } catch (e) {
    if (!(e instanceof UsersStoreError)) throw e;
    console.error(e); // хранилище недоступно: считаем гостем, но ничего не меняем и не пишем
    return null;
  }
}