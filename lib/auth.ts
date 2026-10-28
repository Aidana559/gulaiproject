import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";

export type Role = "admin" | "moderator" | "user";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}

export type PublicUser = Omit<User, "passwordHash">;

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 күн

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-me";

/* ---------- Пайдаланушылар (data/users.json) ---------- */

async function readUsers(): Promise<User[]> {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, "utf8")) as User[];
  } catch {
    return [];
  }
}

async function writeUsers(users: User[]) {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

export async function findUserByEmail(email: string) {
  const users = await readUsers();
  return users.find((u) => u.email === email.trim().toLowerCase());
}

export async function findUserById(id: string) {
  const users = await readUsers();
  return users.find((u) => u.id === id);
}

export async function createUser(name: string, email: string, password: string) {
  const users = await readUsers();
  const user: User = {
    id: randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    // Бірінші тіркелген адам админ болады, қалғандары — user
    role: users.length === 0 ? "admin" : "user",
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeUsers(users);
  return user;
}

export function toPublic(user: User): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  void _omit;
  return rest;
}

/* ---------- Құпиясөз ---------- */

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

/* ---------- Сессия токені (cookie) ---------- */

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
  return uid ? ((await findUserById(uid)) ?? null) : null;
}