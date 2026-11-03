import { books as base } from "@/data/books";
import { readJson, writeJson } from "./db";

export type AnyBook = Record<string, any> & { id: string | number };
type Overrides = Record<string, Record<string, any>>;
const FILE = "book-overrides.json";

export async function getAllBooks(opts: { includeHidden?: boolean } = {}) {
  const ov = await readJson<Overrides>(FILE, {});
  return (base as unknown as AnyBook[])
    .map((b) => ({ ...b, ...(ov[String(b.id)] ?? {}) }))
    .filter((b) => !b.deleted && (opts.includeHidden || !b.hidden));
}

export async function getBook(id: string) {
  return (await getAllBooks({ includeHidden: true })).find(
    (b) => String(b.id) === id
  );
}

export async function patchBook(id: string, patch: Record<string, any>) {
  const ov = await readJson<Overrides>(FILE, {});
  ov[id] = { ...(ov[id] ?? {}), ...patch };
  await writeJson(FILE, ov);
}