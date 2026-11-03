import { NextResponse } from "next/server";
import { getAllBooks } from "@/lib/books-store";
import { readJson, uid, writeJson } from "@/lib/db";
import { bad, forbidden, getActor, isStaff, unauthorized } from "@/lib/server-auth";
import type { Report, User } from "@/lib/types";

const FILE = "reports.json";

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (!isStaff(actor)) return forbidden();
  const reports = await readJson<Report[]>(FILE, []);
  const books = await getAllBooks({ includeHidden: true });
  const users = await readJson<User[]>("users.json", []);
  return NextResponse.json(
    reports
      .map((r) => ({
        ...r,
        bookTitle: books.find((b) => String(b.id) === r.bookId)?.title ?? "(удалено)",
        reporterName: users.find((u) => String(u.id) === r.reporterId)?.name ?? "?",
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  const { bookId, reason } = await req.json();
  const text = String(reason ?? "").trim();
  if (text.length < 5) return bad("Укажите причину (минимум 5 символов)");
  const reports = await readJson<Report[]>(FILE, []);
  reports.push({
    id: uid(), bookId: String(bookId), reporterId: String(actor.id),
    reason: text.slice(0, 500), status: "open", createdAt: new Date().toISOString(),
  });
  await writeJson(FILE, reports);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (!isStaff(actor)) return forbidden();
  const { id, status } = await req.json();
  const reports = await readJson<Report[]>(FILE, []);
  const r = reports.find((x) => x.id === id);
  if (!r) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  r.status = status === "open" ? "open" : "closed";
  await writeJson(FILE, reports);
  return NextResponse.json({ ok: true });
}