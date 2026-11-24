import { NextResponse } from "next/server";
import {
  TaxonomyError,
  addCategory,
  addGenre,
  deleteCategory,
  deleteGenre,
  getTaxonomy,
  getUsage,
  updateCategory,
  updateGenre,
} from "@/lib/taxonomy-store";
import { bad, forbidden, getActor, unauthorized } from "@/lib/server-auth";


export async function GET(req: Request) {
  const taxonomy = await getTaxonomy();
  if (new URL(req.url).searchParams.get("usage") === "1") {
    const actor = await getActor(req);
    if (actor?.role === "admin") return NextResponse.json({ ...taxonomy, usage: await getUsage() });
  }
  return NextResponse.json(taxonomy);
}

async function adminOnly(req: Request) {
  const actor = await getActor(req);
  if (!actor) return { res: unauthorized() };
  if (actor.role !== "admin") return { res: forbidden() };
  return { actor };
}

async function run(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json({ ok: true, ...((await fn()) as object) });
  } catch (e) {
    if (e instanceof TaxonomyError) return bad(e.message);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const a = await adminOnly(req);
  if (a.res) return a.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.kind === "category") return run(async () => ({ taxonomy: await addCategory(b.label, b.singular, b.icon) }));
  if (b.kind === "genre") return run(async () => ({ taxonomy: await addGenre(b.name) }));
  return bad("Неизвестный тип");
}

export async function PATCH(req: Request) {
  const a = await adminOnly(req);
  if (a.res) return a.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.kind === "category") return run(async () => ({ taxonomy: await updateCategory(String(b.key ?? ""), b.label, b.singular, b.icon) }));
  if (b.kind === "genre") return run(async () => updateGenre(String(b.id ?? ""), b.name));
  return bad("Неизвестный тип");
}

export async function DELETE(req: Request) {
  const a = await adminOnly(req);
  if (a.res) return a.res;
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind");
  if (kind === "category") return run(() => deleteCategory(sp.get("key") ?? "", sp.get("moveTo") ?? undefined));
  if (kind === "genre") return run(() => deleteGenre(sp.get("id") ?? ""));
  return bad("Неизвестный тип");
}
