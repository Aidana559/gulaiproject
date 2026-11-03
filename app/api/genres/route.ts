import { NextResponse } from "next/server";
import { readJson, uid, writeJson } from "@/lib/db";
import { bad, forbidden, getActor, unauthorized } from "@/lib/server-auth";
import type { Genre } from "@/lib/types";

const FILE = "genres.json";

export async function GET() {
  return NextResponse.json(await readJson<Genre[]>(FILE, []));
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return forbidden();
  const { name, type } = await req.json();
  const n = String(name ?? "").trim();
  if (!n) return bad("Введите название");
  const list = await readJson<Genre[]>(FILE, []);
  if (list.some((g) => g.name.toLowerCase() === n.toLowerCase() && g.type === type))
    return bad("Уже существует");
  list.push({ id: uid(), name: n.slice(0, 60), type: type === "category" ? "category" : "genre" });
  await writeJson(FILE, list);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return forbidden();
  const id = new URL(req.url).searchParams.get("id");
  const list = await readJson<Genre[]>(FILE, []);
  await writeJson(FILE, list.filter((g) => g.id !== id));
  return NextResponse.json({ ok: true });
}