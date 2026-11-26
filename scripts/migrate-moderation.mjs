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

const existingId = (ids, id) =>
  id != null && ids.has(String(id))
    ? String(id)
    : null;

const notifications = read("notifications").map((n) => ({
  id: String(n.id),
  user_id: existingId(userIds, n.userId),
  legacy_user_id: String(n.userId),
  type: n.type,
  text: n.text,
  href: n.href ?? null,
  key: n.key ?? null,
  moderation: n.moderation ?? null,
  read: n.read ?? false,
  created_at: n.createdAt,
  legacy_data: n,
}));

const reports = read("reports").map((r) => ({
  id: String(r.id),
  target_type: r.targetType,
  target_id: String(r.targetId),
  target_label: r.targetLabel ?? null,
  book_id: existingId(bookIds, r.bookId),
  legacy_book_id:
    r.bookId != null ? String(r.bookId) : null,
  reporter_id: existingId(userIds, r.reporterId),
  reason_code: r.reasonCode ?? null,
  reason: r.reason,
  status: r.status,
  decision: r.decision ?? null,
  decision_note: r.decisionNote ?? null,
  handled_by: r.handledBy ?? null,
  handled_by_id: existingId(userIds, r.handledById),
  handled_by_role: r.handledByRole ?? null,
  handled_at: r.handledAt ?? null,
  closed_with_report_id:
    r.closedWithReportId ?? null,
  trail: r.trail ?? [],
  created_at: r.createdAt,
  updated_at: r.updatedAt ?? null,
  legacy_data: r,
}));

const moderationLogs = read("moderation-log").map((m) => ({
  id: String(m.id),
  book_id: String(m.bookId),
  book_title: m.bookTitle,
  author_id: m.authorId ?? null,
  author_name: m.authorName,
  action: m.action,
  actor_id: m.actorId ?? null,
  actor_name: m.actorName,
  actor_role: m.actorRole,
  reason: m.reason ?? null,
  until: m.until ?? null,
  state_after: m.stateAfter,
  created_at: m.createdAt,
  legacy_data: m,
}));

const reviews = read("reviews");

if (reviews.length !== 0) {
  throw new Error("Review mapping requires verification");
}

const tables = [
  ["notifications", notifications],
  ["reports", reports],
  ["moderation_logs", moderationLogs],
  ["reviews", reviews],
];

const actions = [
  "hidden",
  "published",
  "deleted",
  "deleted_by_owner",
  "restored",
  "hidden_by_owner",
  "shown_by_owner",
  "approved",
  "auto_published",
];

const states = [
  "published",
  "pending",
  "hidden",
  "deleted",
];

for (const row of moderationLogs) {
  if (!actions.includes(row.action)) {
    throw new Error(`Invalid moderation action: ${row.id}`);
  }

  if (!states.includes(row.state_after)) {
    throw new Error(`Invalid moderation state: ${row.id}`);
  }

  if (
    !["admin", "moderator", "user", "system"]
      .includes(row.actor_role)
  ) {
    throw new Error(`Invalid actor role: ${row.id}`);
  }
}

for (const row of reports) {
  if (!row.reporter_id) {
    throw new Error(`Missing reporter: ${row.id}`);
  }
}

for (const [table, rows] of tables) {
  const ids = new Set();

  for (const row of rows) {
    if (
      !row.id ||
      ["undefined", "null"].includes(row.id) ||
      ids.has(row.id)
    ) {
      throw new Error(`Invalid ID in ${table}`);
    }

    if (Number.isNaN(Date.parse(row.created_at))) {
      throw new Error(`Invalid date in ${table}`);
    }

    ids.add(row.id);
  }

  const { count, error } = await supabase
    .from(table)
    .select("id", {
      count: "exact",
      head: true,
    });

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  if (count !== 0) {
    throw new Error(`${table} is not empty`);
  }

  console.log(
    `${table}: source=${rows.length}, database=${count}`
  );
}

console.log(
  "Historical notifications:",
  notifications.filter((n) => !n.user_id).length
);

console.log(
  "Historical reports:",
  reports.filter((r) => r.legacy_book_id && !r.book_id).length
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

  console.log("Moderation migration completed.");
}