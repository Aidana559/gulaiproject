import { promises as fs } from "fs";
import path from "path";
import type { Book, Status } from "@/data/books";
import { categoryLabels, categoryLabelsSingular, normalizeCategory, normalizeGenreList, parseCategory, sameGenre, type Category } from "./categories";
import { readJson, uid, withLock } from "./db";
import { MAX_GENRES, bookState } from "./moderation-shared";
import { genresOf } from "./genres";
import { getBookStates } from "./bookings";
import { readSupabaseBooks, saveSupabaseBook, incrementSupabaseViews } from "./supabase-books";
import { getTaxonomy } from "./taxonomy-store";
const RU = new Intl.Collator("ru", {
  sensitivity: "base",
  numeric: true,
});

export type Condition = "new" | "used" | "annotated";

export const conditionLabels: Record<Condition, string> = {
  new: "Новая",
  used: "Б/у",
  annotated: "С пометками",
};


export type ServerBook = Book & {
  ownerId?: string;
  condition?: Condition;
  campus?: string; 
  coverUrl?: string | null;
  views?: number;
  createdAt?: string;
  hidden?: boolean;
  ownerHidden?: boolean;
  ownerHiddenAt?: string;
  deleted?: boolean;
  updatedAt?: string;
  reviewed?: boolean;
  moderationNote?: string;
  hiddenUntil?: string | null;
  hiddenReason?: string;
  hiddenAt?: string;
  hiddenBy?: { id: string; name: string; role: string };
  deletedAt?: string;
  deletedReason?: string;
  deletedBy?: { id: string; name: string; role: string };
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-teal-500 to-emerald-600",
  "from-rose-500 to-orange-500",
  "from-sky-500 to-blue-700",
  "from-amber-400 to-orange-600",
  "from-fuchsia-500 to-pink-600",
  "from-cyan-500 to-teal-700",
  "from-violet-500 to-indigo-700",
];

export { genresOf };

function canonBook(b: ServerBook): ServerBook {
  const category = normalizeCategory(b.category);
  const genres = genresOf(b);
  const sameGenres = Array.isArray(b.genres) && b.genres.length === genres.length && b.genres.every((g, i) => g === genres[i]);
  if (category === b.category && sameGenres && (b.genre === (genres[0] ?? "—") || (!b.genre && !genres.length))) return b;
  return { ...b, category, genres, genre: genres[0] ?? "—" };
}

export function normalizeGenres(input: unknown): string[] {
  return normalizeGenreList(input, MAX_GENRES);
}

export function isHiddenNow(
  b: { hidden?: boolean; hiddenUntil?: string | null; ownerHidden?: boolean },
  now = Date.now(),
): boolean {
  if (b.ownerHidden) return true;
  if (!b.hidden) return false;
  if (!b.hiddenUntil) return true;
  return new Date(b.hiddenUntil).getTime() > now;
}

export function isPendingReview(
  b: Pick<ServerBook, "ownerId" | "reviewed">
): boolean {
  return b.ownerId != null &&
    Boolean(String(b.ownerId)) &&
    !b.reviewed;
}

export async function getAllBooks(
  opts: { includeHidden?: boolean; includeDeleted?: boolean } = {},
): Promise<ServerBook[]> {
  await getTaxonomy();
  const books = await readSupabaseBooks();
  const now = Date.now();
  return books.map(canonBook).filter(
    (b) =>
      (opts.includeDeleted || !b.deleted) && (opts.includeHidden || !isHiddenNow(b, now)),
  );
}

export async function getBook(
  id: string,
  opts: { includeHidden?: boolean; includeDeleted?: boolean } = {},
): Promise<ServerBook | undefined> {
  const all = await getAllBooks({ includeHidden: true, includeDeleted: true });
  const book = all.find((b) => String(b.id) === String(id));
  if (!book) return undefined;
  if (book.deleted && !opts.includeDeleted) return undefined;
  if (isHiddenNow(book) && !opts.includeHidden) return undefined;
  return withLiveStatus([book], await getBookStates())[0];
}

export type ListQuery = {
  q?: string;
  category?: string;
  genre?: string | string[];
  author?: string;
  year?: number;
  status?: string;
  state?: "published" | "pending" | "hidden" | "deleted" | "all";
  owner?: { id: string; name?: string };
  sort?: "title" | "new" | "popular";
  page?: number;
  limit?: number;
  includeHidden?: boolean;
  includeDeleted?: boolean;
};

export type ListResult = {
  books: ServerBook[];
  genres: string[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};
function withLiveStatus<T extends { id: number | string; status: Status }>(
  list: T[],
  states: Record<string, "reserved" | "given">,
): T[] {
  return list.map((b) => {
    const live: Status = states[String(b.id)] ?? "available";
    return b.status === live ? b : { ...b, status: live };
  });
}


export async function listBooks(query: ListQuery): Promise<ListResult> {
  let list = withLiveStatus(
    await getAllBooks({
      includeHidden: query.includeHidden,
      includeDeleted: query.includeDeleted,
    }),
    await getBookStates(),
  );

  if (query.owner) {
    const { id: oid, name: oname } = query.owner;
    list = list.filter(
      (b) =>
        (b.ownerId != null && String(b.ownerId) === String(oid)) ||
        (b.ownerId == null && !!oname && b.owner === oname),
    );
  }
  if (query.state && query.state !== "all") {
    const want = query.state;
    list = list.filter((b) => bookState(b) === want);
  }

  const q = (query.q ?? "").trim().toLowerCase();
  if (q) {
    const qk = q.replace(/ё/g, "е");
    list = list.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        genresOf(b).some((g) => g.toLowerCase().replace(/ё/g, "е").includes(qk)) ||
        categoryLabels[b.category]?.toLowerCase().includes(q) ||
        categoryLabelsSingular[b.category]?.toLowerCase().includes(q),
    );
  }
  if (query.category && query.category !== "all") {
    const wantCat = parseCategory(query.category);
    list = wantCat ? list.filter((b) => b.category === wantCat) : [];
  }
  if (query.author) {
    const a = query.author.trim().toLowerCase();
    list = list.filter((b) => b.author.trim().toLowerCase() === a);
  }
  if (query.year) {
    list = list.filter((b) => b.year === query.year);
  }
  if (query.status && query.status !== "all") {
    list = list.filter((b) => b.status === query.status);
  }

  const genreFacet = Array.from(new Set(list.flatMap((b) => genresOf(b)))).sort(RU.compare);

  const wantedGenres = (Array.isArray(query.genre) ? query.genre : [query.genre ?? ""])
    .map((g) => g.trim())
    .filter((g) => g && g !== "all");
  if (wantedGenres.length) {
    list = list.filter((b) => {
      const have = genresOf(b);
      return wantedGenres.every((w) => have.some((g) => sameGenre(g, w)));
    });
  }

  const sort = query.sort ?? "title";
  if (sort === "new") {
    list = [...list].sort((a, b) => {
      const da = a.createdAt ?? "";
      const db = b.createdAt ?? "";
      if (da !== db) return db.localeCompare(da);
      return Number(b.id) - Number(a.id);
    });
  } else if (sort === "popular") {
    list = [...list].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  } else {
    list = [...list].sort((a, b) => RU.compare(a.title, b.title));
  }

  const limit = Math.min(Math.max(query.limit ?? 24, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const books = list.slice(start, start + limit);

  return { books, genres: genreFacet, total, page, limit, pages };
}

export type CreateBookInput = {
  title: string;
  author: string;
  category: Category;
  genre?: string;
  genres?: string[];
  year?: number;
  pages?: number;
  city?: string;
  campus?: string;
  description?: string;
  condition?: Condition;
  coverUrl?: string | null;
  ownerId: string;
  ownerName: string;
};

export function createBook(input: CreateBookInput): Promise<ServerBook> {
  return withLock("catalog-file", () => withLock("user-books", () => createBookUnlocked(input)));
}

async function maxReferencedBookNumber(): Promise<number> {
  let max = 0;
  const bump = (v: unknown) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > max) max = n;
  };
  type Ref = { bookId?: unknown; targetType?: string; targetId?: unknown };
  for (const file of ["bookings.json", "moderation-log.json", "reports.json", "reviews.json", "transactions.json", "demo-tx-state.json"]) {
    for (const r of await readJson<Ref[]>(file, [])) {
      bump(r.bookId);
      if (r.targetType === "book") bump(r.targetId);
    }
  }
  return max;
}

async function createBookUnlocked(input: CreateBookInput): Promise<ServerBook> {
  const all = await getAllBooks({ includeHidden: true, includeDeleted: true });
  const referenced = await maxReferencedBookNumber();
  const maxNum = all.reduce((m, b) => {
    const n = Number(b.id);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, Math.max(1000, referenced));
  const id = maxNum + 1;
  const genres = normalizeGenres(input.genres ?? input.genre);
  const now = new Date().toISOString();

  const book: ServerBook = {
    id,
    title: input.title.trim(),
    author: input.author.trim(),
    category: input.category,
    genre: genres[0] ?? "—",
    genres,
    year: input.year || new Date().getFullYear(),
    pages: input.pages || 0,
    city: (input.city ?? "").trim() || "—",
    campus: (input.campus ?? "").trim() || undefined,
    description: (input.description ?? "").trim() || "",
    condition: input.condition ?? "used",
    status: "available" as Status,
    owner: input.ownerName,
    ownerId: input.ownerId,
    gradient: GRADIENTS[id % GRADIENTS.length],
    coverUrl: input.coverUrl ?? null,
    views: 0,
    createdAt: now,
    updatedAt: now,
    hidden: false,
    deleted: false,
    reviewed: false,
  };

  return saveSupabaseBook(book, true);
}

function withGenres(current: ServerBook, patch: Partial<ServerBook>): Partial<ServerBook> {
  if (Array.isArray(patch.genres)) {
    const list = normalizeGenres(patch.genres);
    return { ...patch, genres: list, genre: list[0] ?? "—" };
  }
  if (typeof patch.genre !== "string") return patch;
  const list = genresOf(current);
  if (list.includes(patch.genre)) {
    return { ...patch, genres: [patch.genre, ...list.filter((g) => g !== patch.genre)] };
  }
  return { ...patch, genres: patch.genre && patch.genre !== "—" ? [patch.genre] : [] };
}

export function patchBook(
  id: string,
  patch: Partial<ServerBook>,
): Promise<ServerBook | undefined> {
  return withLock("user-books", () => patchBookUnlocked(id, patch));
}

async function patchBookUnlocked(
  id: string,
  patch: Partial<ServerBook>,
): Promise<ServerBook | undefined> {
  const base = (await readSupabaseBooks()).find((b) => String(b.id) === String(id));
  if (!base) return undefined;
  const changes = withGenres(base, patch);
  if (changes.author === base.author) delete changes.author;
  return saveSupabaseBook({ ...changes, id: Number(base.id), updatedAt: new Date().toISOString() }, false);
}

export async function softDeleteBook(id: string) {
  return patchBook(id, { deleted: true });
}

export async function incrementViews(id: string) {
  await incrementSupabaseViews(id);
}

export async function saveCoverFile(file: File): Promise<string> {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new Error("Только JPG, PNG или WebP");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Файл больше 5 МБ");
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const name = `${uid()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}