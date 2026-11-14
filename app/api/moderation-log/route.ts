import { NextResponse } from "next/server";
import { readLog, sweepExpiredHides } from "@/lib/moderation";
import { forbidden, getActor, isStaff, unauthorized } from "@/lib/server-auth";

/** Журнал действий администрации над книгами (только для администрации). */
export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (!isStaff(actor)) return forbidden();

  await sweepExpiredHides().catch(() => 0);
  const sp = new URL(req.url).searchParams;
  const action = sp.get("action");
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 500);

  let items = (await readLog()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (action && action !== "all") items = items.filter((e) => e.action === action);
  if (q) {
    items = items.filter((e) =>
      [e.bookTitle, e.authorName, e.actorName, e.reason ?? ""].some((s) => s.toLowerCase().includes(q)),
    );
  }
  return NextResponse.json(
    { items: items.slice(0, limit), total: items.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
