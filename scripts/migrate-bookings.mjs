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

async function load(table, fields) {
  const { data, error } = await supabase
    .from(table)
    .select(fields);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data;
}

const [users, books] = await Promise.all([
  load("users", "id"),
  load("books", "id"),
]);

const userIds = new Set(users.map((u) => u.id));
const bookIds = new Set(books.map((b) => b.id));

const bookings = read("bookings").map((b) => {
  const bookId = String(b.bookId);
  const userId = String(b.userId);

  if (!userIds.has(userId)) {
    throw new Error(`Missing booking user: ${b.id}`);
  }

  return {
    id: String(b.id),
    user_id: userId,
    book_id: bookIds.has(bookId) ? bookId : null,
    legacy_book_id: bookId,
    legacy_user_id: userId,
    user_name: b.userName ?? null,
    book_title: b.bookTitle,
    book_author: b.bookAuthor ?? null,
    status: b.status,
    created_at: b.createdAt,
    start_date: b.startDate,
    due_date: b.dueDate,
    returned_at: b.returnedAt ?? null,
    hidden_by_borrower: b.hiddenByBorrower ?? false,
    legacy_data: b,
  };
});

const transactions = read("transactions").map((t) => {
  const bookId = String(t.bookId);

  if (!bookIds.has(bookId)) {
    throw new Error(`Missing transaction book: ${t.id}`);
  }

  return {
    id: String(t.id),
    book_id: bookId,
    legacy_book_id: bookId,
    booking_id: null,
    user_id: null,
    person: t.person,
    status: t.status,
    start_date: t.startDate,
    due_date: t.dueDate,
    legacy_data: t,
  };
});

const tables = [
  ["bookings", bookings],
  ["transactions", transactions],
];

const statuses = {
  bookings: [
    "reserved",
    "borrowed",
    "returned",
    "cancelled",
  ],
  transactions: [
    "reserved",
    "borrowed",
    "overdue",
    "returned",
    "cancelled",
  ],
};

for (const [table, rows] of tables) {
  const ids = new Set();

  for (const row of rows) {
    if (!row.id || ids.has(row.id)) {
      throw new Error(`Invalid ID in ${table}`);
    }

    ids.add(row.id);

    if (!statuses[table].includes(row.status)) {
      throw new Error(`Invalid status in ${table}: ${row.id}`);
    }

    const start = Date.parse(row.start_date);
    const due = Date.parse(row.due_date);

    if (
      Number.isNaN(start) ||
      Number.isNaN(due) ||
      due < start
    ) {
      throw new Error(`Invalid dates in ${table}: ${row.id}`);
    }
  }
}

const pending = [];

for (const [table, rows] of tables) {
  const existing = await load(table, "id");

  if (existing.length !== 0) {
    throw new Error(`${table} is not empty`);
  }

  pending.push([table, rows]);

  console.log(
    `${table}: source=${rows.length}, database=${existing.length}`
  );
}

console.log(
  "Historical bookings:",
  bookings.filter((b) => b.book_id === null).length
);

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

  for (const [table, rows] of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("id", {
        count: "exact",
        head: true,
      });

    if (error || count !== rows.length) {
      throw new Error(`${table}: verification failed`);
    }
  }

  console.log("Bookings and transactions migration completed.");
}