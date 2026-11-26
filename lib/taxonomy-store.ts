import { supabase } from "./supabase-server";
import { readSupabaseBooks } from "./supabase-books";
import { withLock, uid } from "./db";
import {
  CANONICAL_GENRES,
  categoryPoster,
  DEFAULT_CATEGORIES,
  genreKey,
  normalizeGenreName,
  parseCategory,
  setCategoryRegistry,
  setGenreRegistry,
  type CategoryDef,
} from "./categories";

export type GenreDef = { id: string; name: string };
export type Taxonomy = { categories: CategoryDef[]; genres: GenreDef[] };
export type TaxonomyUsage = { categories: Record<string, number>; genres: Record<string, number> };

export const CATEGORY_LABEL_MAX = 40;
export const GENRE_MAX = 60;

type BookLike = { id: number | string; category?: string; genre?: string; genres?: string[]; deleted?: boolean; [k: string]: unknown };

const seedGenres = (): GenreDef[] => CANONICAL_GENRES.map((name, i) => ({ id: `g${i + 1}`, name }));

function sanitize(raw: Partial<Taxonomy> | null | undefined): Taxonomy {
  const cats = Array.isArray(raw?.categories)
    ? raw!.categories.filter((c) => c && typeof c.key === "string" && typeof c.label === "string")
    : [];
  const genres = Array.isArray(raw?.genres)
    ? raw!.genres.filter((g) => g && typeof g.id === "string" && typeof g.name === "string")
    : [];
  return {
    categories: raw?.categories
      ? cats.map((c) => ({
          key: c.key,
          ...(categoryPoster(c) ? { poster: categoryPoster(c) } : {}),
          label: c.label,
          singular: c.singular || c.label,
          ...(typeof (c as CategoryDef).icon === "string" && (c as CategoryDef).icon
            ? { icon: String((c as CategoryDef).icon) }
            : {}),
        }))
      : DEFAULT_CATEGORIES,
    genres: raw?.genres ? genres : seedGenres(),
  };
}


export async function getTaxonomy(): Promise<Taxonomy> {
  const [cats, genres] = await Promise.all([supabase.from("categories").select("*"), supabase.from("genres").select("id,name")]);
  if (cats.error || genres.error) throw new Error(cats.error?.message ?? genres.error?.message);
  const t = sanitize({ categories: cats.data ?? [], genres: (genres.data ?? []).sort((a, b) => a.name.localeCompare(b.name, "ru")) });
  setCategoryRegistry(t.categories);
  setGenreRegistry(t.genres.map((g) => g.name));
  return t;
}

async function mutate(action: string, id: string, values: Record<string, unknown> = {}): Promise<number> {
  const { data, error } = await supabase.rpc("kitapta_taxonomy_mutate", { p_action: action, p_id: id, p_values: values });
  if (error) fail(error.message);
  return Number(data ?? 0);
}




const cleanLabel = (v: unknown, max: number) =>
  String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ә: "a", і: "i", ң: "n", ғ: "g", ү: "u", ұ: "u", қ: "k", ө: "o", һ: "h",
};

function slugify(label: string): string {
  const s = label
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return s || "cat";
}

function uniqueKey(label: string, taken: Set<string>): string {
  const base = slugify(label);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  let key: string;
  do { key = `${base}-${uid().slice(0, 6)}`; } while (taken.has(key));
  return key;
}


async function allBooksForCount(): Promise<BookLike[]> {
  return (await readSupabaseBooks())
  .filter((b) => !b.deleted)
  .map((b): BookLike => ({ ...b }));
}

const bookGenres = (b: BookLike): string[] => {
  const raw = Array.isArray(b.genres) && b.genres.length ? b.genres : b.genre ? [b.genre] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of raw) {
    const n = normalizeGenreName(g);
    if (!n || seen.has(genreKey(n))) continue;
    seen.add(genreKey(n));
    out.push(n);
  }
  return out;
};


export async function getUsage(): Promise<TaxonomyUsage> {
  await getTaxonomy();
  const books = await allBooksForCount();
  const categories: Record<string, number> = {};
  const genres: Record<string, number> = {};
  for (const b of books) {
    const c = parseCategory(b.category);
    if (c) categories[c] = (categories[c] ?? 0) + 1;
    for (const g of bookGenres(b)) genres[genreKey(g)] = (genres[genreKey(g)] ?? 0) + 1;
  }
  return { categories, genres };
}


export class TaxonomyError extends Error {}
function fail(m: string): never {
  throw new TaxonomyError(m);
}


function validatePoster(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string" || raw.length > 1500000) fail("Постер слишком большой");
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw);
  if (!match) fail("Допустимы только PNG, JPEG и WebP");
  const bytes = Buffer.from(match[2], "base64");
  const valid = match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP";
  if (!valid) fail("Некорректное изображение");
  return raw;
}

export function addCategory(labelRaw: unknown, singularRaw?: unknown, iconRaw?: unknown, posterRaw?: unknown): Promise<Taxonomy> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    const label = capitalize(cleanLabel(labelRaw, CATEGORY_LABEL_MAX));
    const singular = capitalize(cleanLabel(singularRaw, CATEGORY_LABEL_MAX)) || label;
    if (label.length < 2) fail("Название категории — не короче 2 символов");
    if (t.categories.some((c) => c.label.toLowerCase() === label.toLowerCase() || c.singular.toLowerCase() === singular.toLowerCase()))
      fail("Такая категория уже есть");
    const taken = new Set([...DEFAULT_CATEGORIES.map((c) => c.key), ...t.categories.map((c) => c.key)]);
    const key = uniqueKey(label, taken);
    const icon = typeof iconRaw === "string" && iconRaw.trim() ? iconRaw.trim() : undefined;
    const poster = validatePoster(posterRaw);
    const entry: CategoryDef = { key, label, singular, ...(icon ? { icon } : {}), ...(poster ? { poster } : {}) };
    await mutate("add_category", key, { ...entry, icon: icon ?? null, poster: poster ?? null });
    return getTaxonomy();
  });
}

export function updateCategory(key: string, labelRaw: unknown, singularRaw?: unknown, iconRaw?: unknown, posterRaw?: unknown): Promise<Taxonomy> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    const cur = t.categories.find((c) => c.key === key);
    if (!cur) fail("Категория не найдена");
    const label = capitalize(cleanLabel(labelRaw, CATEGORY_LABEL_MAX));
    const singular = capitalize(cleanLabel(singularRaw, CATEGORY_LABEL_MAX)) || label;
    if (label.length < 2) fail("Название категории — не короче 2 символов");
    if (
      t.categories.some(
        (c) => c.key !== key && (c.label.toLowerCase() === label.toLowerCase() || c.singular.toLowerCase() === singular.toLowerCase()),
      )
    )
      fail("Такая категория уже есть");
    const icon =
      iconRaw === null
        ? undefined
        : typeof iconRaw === "string"
          ? iconRaw.trim() || undefined
          : cur.icon;
    const poster = posterRaw === undefined ? cur.poster : validatePoster(posterRaw);
    const entry: CategoryDef = { ...cur, key, label, singular, icon, poster };
    await mutate("update_category", key, { ...entry, icon: icon ?? null, poster: poster ?? null });
    return getTaxonomy();
  });
}


export function deleteCategory(key: string, _moveTo?: string): Promise<{ taxonomy: Taxonomy; moved: number }> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    if (!t.categories.some((c) => c.key === key)) fail("Категория не найдена");
    if (t.categories.length <= 1) fail("Нельзя удалить последнюю категорию");
    const moved = await mutate("delete_category", key, { moveTo: _moveTo ?? null });
    return { taxonomy: await getTaxonomy(), moved };
  });
}



function checkGenreName(t: Taxonomy, raw: unknown, selfId?: string): string {
  const name = capitalize(cleanLabel(raw, GENRE_MAX));
  if (name.length < 2) fail("Название жанра — не короче 2 символов");
  const k = genreKey(name);
  const viaAlias = genreKey(normalizeGenreName(name));
  for (const g of t.genres) {
    if (g.id === selfId) continue;
    const gk = genreKey(g.name);
    if (gk === k || gk === viaAlias) fail(`Жанр «${g.name}» уже есть`);
  }
  return name;
}

export function addGenre(raw: unknown): Promise<Taxonomy> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    const name = checkGenreName(t, raw);
    await mutate("add_genre", uid(t.genres), { name });
    return getTaxonomy();
  });
}


export function updateGenre(id: string, raw: unknown): Promise<{ taxonomy: Taxonomy; updated: number }> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    const cur = t.genres.find((g) => g.id === id);
    if (!cur) fail("Жанр не найден");
    const name = checkGenreName(t, raw, id);
    const updated = await mutate("update_genre", id, { name });
    return { taxonomy: await getTaxonomy(), updated };
  });
}


export function deleteGenre(id: string): Promise<{ taxonomy: Taxonomy; updated: number }> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    const cur = t.genres.find((g) => g.id === id);
    if (!cur) fail("Жанр не найден");
    const updated = await mutate("delete_genre", id);
    return { taxonomy: await getTaxonomy(), updated };
  });
}
