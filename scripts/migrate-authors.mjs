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

const cache = JSON.parse(
  readFileSync("data/authors.json", "utf8")
);

const manual = JSON.parse(
  readFileSync("data/authors-manual.json", "utf8")
);

const cacheRows = cache.map((entry) => ({
  key: entry.key,
  status: entry.status,
  info: entry.info ?? null,
  version: entry.v ?? null,
  fetched_at: entry.fetchedAt,
  legacy_data: entry,
}));

const keys = new Set([
  ...cache.map((entry) => entry.key),
  ...Object.keys(manual),
]);

const authors = [...keys].map((key) => {
  const cached = cache.find((entry) => entry.key === key);
  const custom = manual[key] ?? {};
  const info = {
    ...(cached?.info ?? {}),
    ...custom,
  };

  return {
    id: key,
    name: info.name || key,
    description: info.description ?? null,
    biography: info.extract ?? null,
    photo_url: info.photo ?? null,
    born: info.born ?? null,
    died: info.died ?? null,
    birthplace: info.birthPlace ?? null,
    source_url: info.url ?? null,
    updated_at: cached?.fetchedAt ?? new Date().toISOString(),
    legacy_data: {
      cache: cached ?? null,
      manual: manual[key] ?? null,
    },
  };
});

const aliases = authors.map((author) => ({
  author_id: author.id,
  alias: author.id,
}));

if (new Set(cacheRows.map((row) => row.key)).size !== cacheRows.length) {
  throw new Error("Duplicate author cache keys");
}

for (const row of cacheRows) {
  if (
    !row.key ||
    !row.status ||
    !row.fetched_at ||
    Number.isNaN(Date.parse(row.fetched_at))
  ) {
    throw new Error("Invalid author cache entry");
  }
}

const tables = [
  ["authors", authors, "id"],
  ["author_cache", cacheRows, "key"],
  ["author_aliases", aliases, "id"],
];

for (const [table, rows, pk] of tables) {
  const { count, error } = await supabase
    .from(table)
    .select(pk, { count: "exact", head: true });

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  console.log(
    `${table}: source=${rows.length}, database=${count}`
  );

  if (count !== 0) {
    throw new Error(`${table} is not empty`);
  }
}

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

  for (const [table, rows, pk] of tables) {
    const { count, error } = await supabase
      .from(table)
      .select(pk, { count: "exact", head: true });

    if (error || count !== rows.length) {
      throw new Error(`${table}: verification failed`);
    }
  }

  console.log("Authors migration completed.");
}