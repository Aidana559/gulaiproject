import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

const apply = process.argv.includes("--apply");

const read = (name) =>
  JSON.parse(readFileSync(`data/${name}.json`, "utf8"));

const catalog = read("catalog-books");
const userBooks = read("user-books");

const authorKey = (name) =>
  name.trim().toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");

const genreKey = (name) =>
  String(name).toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .trim();

function splitAuthors(name) {
  const parts = name
    .split(/\s*(?:[,;&]|\s+и\s+|\s+and\s+)\s*/i)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);

  if (
    parts.length === 2 &&
    parts.every((x) => !/\s/.test(x))
  ) {
    return [name.trim()];
  }

  return parts.length ? parts : [name.trim()];
}

async function load(table, fields) {
  const { data, error } = await supabase
    .from(table)
    .select(fields);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data;
}

const [
  users,
  categories,
  genres,
  existingAuthors,
  existingAliases,
] = await Promise.all([
  load("users", "id"),
  load("categories", "key"),
  load("genres", "id,name"),
  load("authors", "id,name"),
  load("author_aliases", "author_id,alias"),
]);

const userIds = new Set(users.map((u) => u.id));

const categoryKeys = new Set(
  categories.map((c) => c.key)
);

const genreIds = new Map(
  genres.map((g) => [genreKey(g.name), g.id])
);

const authorIds = new Map(
  existingAuthors.map((a) => [authorKey(a.id), a.id])
);

const catalogMap = new Map(
  catalog.map((b) => [String(b.id), b])
);

const userBookMap = new Map(
  userBooks.map((b) => [String(b.id), b])
);

const merged = new Map([
  ...catalogMap,
  ...userBookMap,
]);

const newAuthors = new Map();
const newAliases = new Map();
const books = [];
const bookAuthors = new Map();
const bookGenres = new Map();

const existingAliasKeys = new Set(
  existingAliases.map((a) =>
    JSON.stringify([
      a.author_id,
      a.alias.toLowerCase(),
    ])
  )
);

for (const [id, b] of merged) {
  if (!b.title || !categoryKeys.has(b.category)) {
    throw new Error(`Invalid book: ${id}`);
  }

  if (
    !["available", "reserved", "given"].includes(b.status)
  ) {
    throw new Error(`Invalid status: ${id}`);
  }

  const originalOwner = b.ownerId
    ? String(b.ownerId)
    : null;

  const ownerId =
    originalOwner && userIds.has(originalOwner)
      ? originalOwner
      : null;

  books.push({
    id,
    title: b.title,
    author: b.author ?? null,
    category_key: b.category,
    owner_id: ownerId,
    legacy_owner_id: originalOwner,
    owner_name: b.owner ?? null,
    description: b.description ?? null,
    isbn: b.isbn ?? null,
    google_id: b.googleId ?? null,
    cover_url: b.coverUrl ?? null,
    gradient: b.gradient ?? null,
    city: b.city ?? null,
    campus: b.campus ?? null,
    lang: b.lang ?? null,
    year: b.year ?? null,
    pages: b.pages ?? null,
    condition: b.condition ?? null,
    status: b.status,
    views: b.views ?? 0,
    reviewed: b.reviewed ?? false,
    hidden: b.hidden ?? false,
    deleted: b.deleted ?? false,
    owner_hidden: b.ownerHidden ?? false,
    owner_hidden_at: b.ownerHiddenAt ?? null,
    hidden_until: b.hiddenUntil ?? null,
    hidden_reason: b.hiddenReason ?? null,
    hidden_at: b.hiddenAt ?? null,
    hidden_by: b.hiddenBy ?? null,
    deleted_at: b.deletedAt ?? null,
    deleted_reason: b.deletedReason ?? null,
    deleted_by: b.deletedBy ?? null,
    moderation_note: b.moderationNote ?? null,
    schema_version: b.schema ?? null,
    created_at: b.createdAt ?? "2026-01-01T00:00:00Z",
    updated_at: b.updatedAt ?? null,
    legacy_data: {
      catalog: catalogMap.get(id) ?? null,
      user: userBookMap.get(id) ?? null,
    },
  });

  for (const name of splitAuthors(b.author ?? "")) {
    if (!name || name === "—") continue;

    const key = authorKey(name);

    if (!authorIds.has(key)) {
      authorIds.set(key, key);

      newAuthors.set(key, {
        id: key,
        name,
      });
    }

    const authorId = authorIds.get(key);

    const aliasKey = JSON.stringify([
      authorId,
      name.toLowerCase(),
    ]);

    if (!existingAliasKeys.has(aliasKey)) {
      newAliases.set(aliasKey, {
        author_id: authorId,
        alias: name,
      });
    }

    bookAuthors.set(
      JSON.stringify([id, authorId]),
      {
        book_id: id,
        author_id: authorId,
      }
    );
  }

  const names = b.genres?.length
    ? b.genres
    : b.genre && b.genre !== "—"
      ? [b.genre]
      : [];

  for (const name of names) {
    const genreId = genreIds.get(genreKey(name));

    if (!genreId) {
      throw new Error(
        `Unknown genre: ${name}, book: ${id}`
      );
    }

    bookGenres.set(
      JSON.stringify([id, genreId]),
      {
        book_id: id,
        genre_id: genreId,
      }
    );
  }
}

const tables = [
  ["authors", [...newAuthors.values()]],
  ["author_aliases", [...newAliases.values()]],
  ["books", books],
  ["book_authors", [...bookAuthors.values()]],
  ["book_genres", [...bookGenres.values()]],
];

for (const table of [
  "books",
  "book_authors",
  "book_genres",
]) {
  const { count, error } = await supabase
    .from(table)
    .select("book_id" === table ? "book_id" : "*", {
      count: "exact",
      head: true,
    });

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  if (count !== 0) {
    throw new Error(`${table} is not empty`);
  }
}

console.table(
  tables.map(([table, rows]) => ({
    table,
    pending: rows.length,
  }))
);

console.log(
  "Missing owners:",
  books.filter(
    (b) => b.legacy_owner_id && !b.owner_id
  ).length
);

if (!apply) {
  console.log("Validation completed. No data modified.");
} else {
  for (const [table, rows] of tables) {
    if (!rows.length) continue;

    const { error } = await supabase
      .from(table)
      .insert(rows);

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }

    console.log(`${table}: imported ${rows.length}`);
  }

  for (const [table, rows] of tables.slice(2)) {
    const { count, error } = await supabase
      .from(table)
      .select("*", {
        count: "exact",
        head: true,
      });

    if (error || count !== rows.length) {
      throw new Error(`${table}: verification failed`);
    }
  }

  console.log("Books migration completed.");
}