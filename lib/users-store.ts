import "server-only";
import { randomUUID } from "node:crypto";
import { supabase } from "./supabase-server";
import type { User } from "./auth";

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

const norm = (s: string) => s.trim().toLowerCase();

function toUser(row: any): User {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
    bio: row.bio ?? undefined,
    avatar: row.avatar ?? null,
    telegram: row.telegram ?? undefined,
    blocked: row.blocked ?? false,
    muted: row.muted ?? false,
    mutedUntil: row.muted_until ?? undefined,
    muteReason: row.mute_reason ?? undefined,
  };
}

export async function loadUsers(): Promise<User[]> {
  const users: User[] = [];
  const size = 500;

  for (let offset = 0; ; offset += size) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + size - 1);

    if (error) {
      throw new UsersStoreError(error.message);
    }

    users.push(...data.map(toUser));

    if (data.length < size) break;
  }

  return users;
}

export const listUsers = loadUsers;

export async function findUserByEmail(email: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", norm(email))
    .maybeSingle();

  if (error) {
    throw new UsersStoreError(error.message);
  }

  return data ? toUser(data) : undefined;
}

export async function findUserById(id: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", String(id))
    .maybeSingle();

  if (error) {
    throw new UsersStoreError(error.message);
  }

  return data ? toUser(data) : undefined;
}

export async function insertUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<User> {
  const { data, error } = await supabase
    .from("users")
    .insert({
      id: randomUUID(),
      name: input.name.trim(),
      email: norm(input.email),
      password_hash: input.passwordHash,
      role: "user",
      blocked: false,
      muted: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new EmailTakenError();
    }

    throw new UsersStoreError(error.message);
  }

  return toUser(data);
}

export async function updateUser(
  id: string,
  patch: Partial<
    Pick<
      User,
      | "role"
      | "blocked"
      | "muted"
      | "mutedUntil"
      | "muteReason"
      | "name"
      | "email"
      | "bio"
      | "avatar"
      | "telegram"
    >
  >
) {
  const updates: Record<string, unknown> = {};

  const fields = {
    role: "role",
    blocked: "blocked",
    muted: "muted",
    mutedUntil: "muted_until",
    muteReason: "mute_reason",
    name: "name",
    email: "email",
    bio: "bio",
    avatar: "avatar",
    telegram: "telegram",
  } as const;

  for (const key of Object.keys(fields) as Array<
    keyof typeof fields
  >) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) {
      continue;
    }

    const value = patch[key];

    updates[fields[key]] =
      key === "email" && typeof value === "string"
        ? norm(value)
        : value ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return (await findUserById(id)) ?? null;
  }

  const profileFields = [
    "name",
    "email",
    "bio",
    "avatar",
    "telegram",
  ];

  const changesProfile = profileFields.some(
    (key) => key in updates
  );

  let query = supabase
    .from("users")
    .update(updates)
    .eq("id", String(id));

  if (changesProfile) {
    query = query.eq("blocked", false);
  }

  const { data, error } = await query
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new EmailTakenError();
    }

    throw new UsersStoreError(error.message);
  }

  return data ? toUser(data) : null;
}

export async function deleteUser(id: string) {
  throw new UsersStoreError(
    "Удаление аккаунтов временно отключено на время миграции"
  );
}