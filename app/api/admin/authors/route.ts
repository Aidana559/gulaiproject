import { NextResponse } from "next/server";
import { getActor, unauthorized, forbidden, bad } from "@/lib/server-auth";
import { getAllBooks } from "@/lib/books-store";
import { authorKey, splitAuthors, listAuthorRecords, saveAuthorRecord, getAuthorInfo, type AuthorInfo } from "@/lib/author-info";

async function catalog() {
  const books = await getAllBooks({ includeHidden: true });
  const map = new Map<string, { name: string; count: number }>();
  for (const b of books) for (const name of splitAuthors(b.author ?? "")) {
    if (!name.trim()) continue;
    const key = authorKey(name);
    const row = map.get(key);
    map.set(key, { name: row?.name ?? name, count: (row?.count ?? 0) + 1 });
  }
  return map;
}
export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return forbidden();
  const records = await listAuthorRecords();
  return NextResponse.json({ authors: Array.from(await catalog(), ([key, row]) => {
    const record = records.find(r => r.key === key);
    return { ...row, info: { ...record?.info, ...record?.manual }, manual: record?.manual ?? {}, aliases: record?.aliases ?? [], status: record?.status ?? "none" };
  }) });
}
export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return forbidden();
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !(await catalog()).has(authorKey(body.name))) return bad("Автор не найден");
  if (body.action === "refresh") return NextResponse.json({ info: await getAuthorInfo(body.name, true) });
  if (body.action !== "save" || !body.manual || !Array.isArray(body.aliases)) return bad("Некорректные данные");
  const manual: Partial<AuthorInfo> = {};
  for (const field of ["description", "extract", "born", "died", "birthPlace", "photo", "url"] as const) {
    const value = body.manual[field];
    if (typeof value !== "string" || value.length > 10000) return bad("Некорректное поле");
    if ((field === "photo" || field === "url") && value && !/^https:\/\//i.test(value)) return bad("Нужна HTTPS-ссылка");
    manual[field] = value.trim();
  }
  if (body.aliases.length > 10 || body.aliases.some((a: unknown) => typeof a !== "string" || a.length > 200)) return bad("Некорректные варианты имени");
  await saveAuthorRecord(body.name, manual, body.aliases.map((a: string) => a.trim()).filter(Boolean));
  return NextResponse.json({ ok: true });
}
