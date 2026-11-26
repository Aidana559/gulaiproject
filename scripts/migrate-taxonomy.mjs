import { existsSync, readFileSync } from "node:fs";
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

const defaultCategories = [
  {
    key: "book",
    label: "Книги",
    singular: "Книга",
    icon: "book",
    poster: "/category-covers/book.webp",
  },
  {
    key: "textbook",
    label: "Учебники",
    singular: "Учебник",
    icon: "graduation",
    poster: "/category-covers/textbook.webp",
  },
  {
    key: "guide",
    label: "Методички",
    singular: "Методичка",
    icon: "file-text",
    poster: "/category-covers/guide.webp",
  },
  {
    key: "manga",
    label: "Манга",
    singular: "Манга",
    icon: "layers",
    poster: "/category-covers/manga.webp",
  },
];

const defaultGenres = [
  "Антиутопия",
  "Биология",
  "Детектив",
  "Инженерия",
  "Информатика",
  "История",
  "Классика",
  "Математика",
  "Наука",
  "Оформление",
  "Приключения",
  "Роман",
  "Саморазвитие",
  "Сказка",
  "Сёдзё",
  "Сёнэн",
  "Сэйнэн",
  "Триллер",
  "Тёмное фэнтези",
  "Фантастика",
  "Физика",
  "Фэнтези",
  "Художественная литература",
  "Химия",
  "Хоррор",
  "Экономика",
  "Экшен",
  "Языки",
]
  .sort((a, b) => a.localeCompare(b, "ru"))
  .map((name, i) => ({
    id: `g${i + 1}`,
    name,
  }));

const taxonomy = existsSync("data/taxonomy.json")
  ? JSON.parse(readFileSync("data/taxonomy.json", "utf8"))
  : {};

const categories = (taxonomy.categories ?? defaultCategories).map(
  (c) => ({
    key: c.key,
    label: c.label,
    singular: c.singular || c.label,
    icon: c.icon ?? null,
    poster:
      c.poster ||
      defaultCategories.find((d) => d.key === c.key)?.poster ||
      null,
  })
);

const genres = (taxonomy.genres ?? defaultGenres).map(
  (g) => ({
    id: g.id,
    name: g.name,
  })
);

const tables = [
  ["categories", categories, "key", "label"],
  ["genres", genres, "id", "name"],
];

for (const [table, rows, pk, label] of tables) {
  const ids = new Set();
  const names = new Set();

  for (const row of rows) {
    if (
      typeof row[pk] !== "string" ||
      !row[pk].trim() ||
      typeof row[label] !== "string" ||
      !row[label].trim()
    ) {
      throw new Error(`Invalid fields in ${table}`);
    }

    const name = row[label].toLowerCase();

    if (ids.has(row[pk]) || names.has(name)) {
      throw new Error(`Duplicate records in ${table}`);
    }

    ids.add(row[pk]);
    names.add(name);
  }
}

const pending = [];

for (const [table, rows, pk] of tables) {
  const { data, error } = await supabase
    .from(table)
    .select("*");

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  const existing = new Map(
    data.map((row) => [row[pk], row])
  );

  const missing = [];

  for (const row of rows) {
    const current = existing.get(row[pk]);

    if (!current) {
      missing.push(row);
      continue;
    }

    for (const field of Object.keys(row)) {
      if (current[field] !== row[field]) {
        throw new Error(`Existing record conflict in ${table}`);
      }
    }
  }

  pending.push([table, missing]);

  console.log(
    `${table}: source=${rows.length}, database=${data.length}, pending=${missing.length}`
  );
}

if (!apply) {
  console.log("Validation completed. No data modified.");
} else {
  for (const [table, rows] of pending) {
    if (!rows.length) continue;

    const { error } = await supabase
      .from(table)
      .insert(rows);

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }

    console.log(`${table}: imported ${rows.length}`);
  }

  console.log("Taxonomy migration completed.");
}