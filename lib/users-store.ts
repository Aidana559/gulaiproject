import { uid } from "./db";
import path from "node:path";
import { readTextRetry, writeFileAtomic } from "./atomic-file";
import type { User } from "./auth";

/**
 * ЕДИНСТВЕННОЕ место, где читается и пишется список пользователей (data/users.json).
 * Регистрация, вход, админка, чат и уведомления идут через эти функции.
 *
 * Гарантии:
 *  - запись атомарная (tmp + rename), частично записанного файла читатель не увидит;
 *  - все изменения идут через mutateUsers: один изменяющий запрос за раз, «прочитал → изменил → записал»
 *    не теряет чужие изменения;
 *  - email уникален (проверка внутри блокировки, без учёта регистра);
 *  - если файл нельзя прочитать или он повреждён, бросается UsersStoreError и НИЧЕГО не записывается.
 *    Раньше любая ошибка чтения превращалась в «нет пользователей», и следующая запись затирала файл.
 *
 * Ограничения: блокировка действует внутри одного процесса Node (для прототипа с одним сервером
 * этого достаточно); при нескольких процессах/инстансах нужна настоящая БД.
 */

export class UsersStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UsersStoreError";
  }
}

export class EmailTakenError extends Error {
  constructor() {
    super("Этот email уже зарегистрирован");
    this.name = "EmailTakenError";
  }
}

const usersFile = () => process.env.USERS_FILE ?? path.join(process.cwd(), "data", "users.json");
const norm = (s: string) => s.trim().toLowerCase();

export async function loadUsers(): Promise<User[]> {
  const file = usersFile();
  let text: string;
  try {
    text = await readTextRetry(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; // первый запуск: файла ещё нет
    throw new UsersStoreError(`Не удалось прочитать ${file}`, { cause: e });
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new UsersStoreError(`Файл пользователей повреждён (${file}); ничего не перезаписано, копия: ${file}.bak`, { cause: e });
  }
  const ok =
    Array.isArray(data) &&
    data.every((u) => u && typeof u === "object" && (u as User).id != null && typeof (u as User).email === "string");
  if (!ok) throw new UsersStoreError(`Неверный формат файла пользователей (${file}); ничего не перезаписано`);
  return data as User[];
}

// Очередь изменений. Ключ в globalThis: в dev-режиме Next может создать модуль несколько раз.
const g = globalThis as unknown as { __usersQueue?: Promise<unknown> };

function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = (g.__usersQueue ?? Promise.resolve()).then(fn);
  g.__usersQueue = run.catch(() => undefined);
  return run;
}

/** Читает актуальный список под блокировкой; если fn вернула users — записывает их атомарно. */
export function mutateUsers<T>(fn: (users: User[]) => { users?: User[]; result: T }): Promise<T> {
  return exclusive(async () => {
    const out = fn(await loadUsers());
    if (out.users) await writeFileAtomic(usersFile(), JSON.stringify(out.users, null, 2), { backup: true });
    return out.result;
  });
}

// ---------- операции ----------
export const listUsers = loadUsers;

export async function findUserByEmail(email: string) {
  const e = norm(email);
  return (await loadUsers()).find((u) => norm(u.email) === e);
}

export async function findUserById(id: string) {
  return (await loadUsers()).find((u) => String(u.id) === String(id));
}

/** Создаёт пользователя с постоянным id. Дубликат email → EmailTakenError. */
export function insertUser(input: { name: string; email: string; passwordHash: string }): Promise<User> {
  const email = norm(input.email);
  return mutateUsers((users) => {
    if (users.some((u) => norm(u.email) === email)) throw new EmailTakenError();
    const user: User = {
      id: uid(users),
      name: input.name.trim(),
      email,
      passwordHash: input.passwordHash,
      role: users.length === 0 ? "admin" : "user", // админ только у самого первого аккаунта пустой системы
      createdAt: new Date().toISOString(),
    };
    return { users: [...users, user], result: user };
  });
}

export function updateUser(
  id: string,
  patch: Partial<Pick<User, "role" | "blocked" | "muted" | "mutedUntil" | "muteReason" | "name">>,
) {
  return mutateUsers((users) => {
    const idx = users.findIndex((u) => String(u.id) === String(id));
    if (idx === -1) return { result: null };
    const next = [...users];
    next[idx] = { ...users[idx], ...patch };
    return { users: next, result: next[idx] };
  });
}

export function deleteUser(id: string) {
  return mutateUsers((users) => {
    const next = users.filter((u) => String(u.id) !== String(id));
    return next.length === users.length ? { result: false } : { users: next, result: true };
  });
}
