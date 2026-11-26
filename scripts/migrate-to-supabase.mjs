import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  throw new Error("Supabase environment variables are missing");
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const apply = process.argv.includes("--apply");

const users = JSON.parse(
  readFileSync("data/users.json", "utf8")
);

const rows = users.map((u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  password_hash: u.passwordHash,
  role: u.role,
  bio: u.bio ?? null,
  avatar: u.avatar ?? null,
  telegram: u.telegram ?? null,
  blocked: u.blocked ?? false,
  muted: u.muted ?? false,
  muted_until: u.mutedUntil ?? null,
  mute_reason: u.muteReason ?? null,
  created_at: u.createdAt,
}));

const ids = new Set();
const emails = new Set();

for (const row of rows) {
  if (
    !row.id ||
    !row.name ||
    !row.email ||
    !row.password_hash ||
    !row.created_at
  ) {
    throw new Error("Missing required user fields");
  }

  if (!["user", "admin", "moderator"].includes(row.role)) {
    throw new Error("Invalid user role");
  }

  if (typeof row.muted !== "boolean") {
    throw new Error("Invalid muted field");
  }

  if (typeof row.blocked !== "boolean") {
    throw new Error("Invalid blocked field");
  }

  if (Number.isNaN(Date.parse(row.created_at))) {
    throw new Error("Invalid creation date");
  }

  const email = row.email.toLowerCase();

  if (ids.has(row.id) || emails.has(email)) {
    throw new Error("Duplicate user");
  }

  ids.add(row.id);
  emails.add(email);
}

const { count, error: countError } = await supabase
  .from("users")
  .select("id", { count: "exact", head: true });

if (countError) {
  throw new Error(countError.message);
}

console.table({
  sourceUsers: rows.length,
  databaseUsers: count,
  admins: rows.filter((u) => u.role === "admin").length,
  moderators: rows.filter((u) => u.role === "moderator").length,
  regularUsers: rows.filter((u) => u.role === "user").length,
});

if (!apply) {
  console.log("Validation completed. No data modified.");
} else {
  if (count !== 0) {
    throw new Error("Users table is not empty");
  }

  const { error } = await supabase
    .from("users")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }

  const { count: imported, error: verifyError } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true });

  if (verifyError) {
    throw new Error(verifyError.message);
  }

  console.log(`Imported users: ${imported}`);

  if (imported !== rows.length) {
    throw new Error("User count mismatch");
  }

  console.log("User migration completed.");
}