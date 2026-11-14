import { promises as fs } from "fs";
import path from "path";
import type { Book, Category, Status } from "@/data/books";
import { readJson, writeJson, uid, withLock } from "./db";
import { MAX_GENRES, bookState } from "./moderation-shared";
import { genresOf } from "./genres";
import { getBookStates } from "./bookings";

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
  /**
   * Книгу скрыл сам автор. Это ВИДИМОСТЬ, она не связана со статусом модерации:
   * hidden/reviewed (решения модерации) автор менять не может.
   */
  ownerHidden?: boolean;
  ownerHiddenAt?: string;
  deleted?: boolean;
  updatedAt?: string;
  reviewed?: boolean;
  moderationNote?: string;
  /** до какого момента книга скрыта администрацией; пусто — бессрочно */
  hiddenUntil?: string | null;
  hiddenReason?: string;
  hiddenAt?: string;
  hiddenBy?: { id: string; name: string; role: string };
  deletedAt?: string;
  deletedReason?: string;
  deletedBy?: { id: string; name: string; role: string };
};

const USER_FILE = "user-books.json";
const CATALOG_FILE = "catalog-books.json"; // каталог, загруженный из Google Books (см. lib/catalog-loader.ts)
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

async function readCatalog(): Promise<ServerBook[]> {
  return readJson<ServerBook[]>(CATALOG_FILE, []);
}

export { genresOf };

/**
 * Приводит список жанров к чистому виду: без пустых, «—» и повторов (без учёта регистра),
 * не больше MAX_GENRES. Книга ↔ жанры — связь «многие ко многим»: у книги список жанров,
 * одна и та же запись жанра может быть у любого числа книг.
 */
export function normalizeGenres(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const g = String(x ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (!g || g === "—") continue;
    const k = g.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(g);
    if (out.length >= MAX_GENRES) break;
  }
  return out;
}

/**
 * Скрыта ли книга из каталога сейчас: скрытие автором (ownerHidden) или скрытие модерацией
 * (учитывается срок временного скрытия — по истечении книга снова видна).
 */
export function isHiddenNow(
  b: { hidden?: boolean; hiddenUntil?: string | null; ownerHidden?: boolean },
  now = Date.now(),
): boolean {
  if (b.ownerHidden) return true;
  if (!b.hidden) return false;
  if (!b.hiddenUntil) return true;
  return new Date(b.hiddenUntil).getTime() > now;
}

async function readUserBooks(): Promise<ServerBook[]> {
  return readJson<ServerBook[]>(USER_FILE, []);
}

async function writeUserBooks(list: ServerBook[]) {
  await writeJson(USER_FILE, list);
}

export async function getAllBooks(
  opts: { includeHidden?: boolean; includeDeleted?: boolean } = {},
): Promise<ServerBook[]> {
  const user = await readUserBooks();
  const staticMapped: ServerBook[] = (await readCatalog()).map((b) => ({
    ...b,
    ownerId: undefined,
    views: b.views ?? 0,
    createdAt: b.createdAt ?? "2026-01-01T00:00:00.000Z",
  }));


  const byId = new Map<string, ServerBook>();
  for (const b of staticMapped) byId.set(String(b.id), b);
  for (const b of user) byId.set(String(b.id), b);

  const now = Date.now();
  return Array.from(byId.values()).filter(
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
  /** один жанр или несколько: книга должна относиться ко ВСЕМ выбранным жанрам */
  genre?: string | string[];
  author?: string;
  year?: number;
  status?: string;
  /** фильтр по состоянию модерации (для панелей администрации и «Моих объявлений») */
  state?: "published" | "pending" | "hidden" | "deleted" | "all";
  /** только книги этого владельца (id или имя) */
  owner?: { id: string; name?: string };
  sort?: "title" | "new" | "popular";
  page?: number;
  limit?: number;
  includeHidden?: boolean;
  includeDeleted?: boolean;
};

export type ListResult = {
  books: ServerBook[];
  /** жанры, которые есть у книг по текущим фильтрам (кроме самого жанра) */
  genres: string[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

/**
 * Реальный статус книги берётся из броней (data/bookings.json), а не из поля book.status:
 * активная бронь → «Забронирована», выдана/просрочена → «Отдана», иначе «Доступна».
 * Так фильтр каталога, карточки и бейджи всегда совпадают с транзакциями.
 */
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
        (!!oname && b.owner === oname),
    );
  }
  if (query.state && query.state !== "all") {
    const want = query.state;
    list = list.filter((b) => bookState(b) === want);
  }

  const q = (query.q ?? "").trim().toLowerCase();
  if (q) {
    // поиск по названию, автору и по любому из жанров книги
    list = list.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        genresOf(b).some((g) => g.toLowerCase().includes(q)),
    );
  }
  if (query.category && query.category !== "all") {
    list = list.filter((b) => b.category === query.category);
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

  // жанры для фильтра: по книгам выбранной категории/поиска, до применения самого жанра
  const genreFacet = Array.from(new Set(list.flatMap((b) => genresOf(b)))).sort((a, b) =>
    a.localeCompare(b, "ru"),
  );

  const wantedGenres = (Array.isArray(query.genre) ? query.genre : [query.genre ?? ""])
    .map((g) => g.trim())
    .filter((g) => g && g !== "all");
  if (wantedGenres.length) {
    // книга попадает в выдачу, если у неё есть каждый из выбранных жанров
    list = list.filter((b) => {
      const have = genresOf(b).map((g) => g.toLowerCase());
      return wantedGenres.every((w) => have.includes(w.toLowerCase()));
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
    list = [...list].sort((a, b) => a.title.localeCompare(b.title, "ru"));
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
  /** устаревший одиночный жанр — используется, если genres не передан */
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
  return withLock("user-books", () => createBookUnlocked(input));
}

async function createBookUnlocked(input: CreateBookInput): Promise<ServerBook> {
  const user = await readUserBooks();
  // удалённые тоже учитываем, чтобы id никогда не повторялся
  const all = await getAllBooks({ includeHidden: true, includeDeleted: true });
  const maxNum = all.reduce((m, b) => {
    const n = Number(b.id);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 1000);
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

  user.unshift(book);
  await writeUserBooks(user);
  return book;
}

/** Если сменили основной жанр — список жанров подстраиваем, не теряя остальные */
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
  // файловое хранилище не атомарно: сериализуем чтение-изменение-запись
  return withLock("user-books", () => patchBookUnlocked(id, patch));
}

async function patchBookUnlocked(
  id: string,
  patch: Partial<ServerBook>,
): Promise<ServerBook | undefined> {
  const user = await readUserBooks();
  const idx = user.findIndex((b) => String(b.id) === String(id));

  if (idx >= 0) {
    user[idx] = { ...user[idx], ...withGenres(user[idx], patch), updatedAt: new Date().toISOString() };
    await writeUserBooks(user);
    return user[idx];
  }


  const base = (await readCatalog()).find((b) => String(b.id) === String(id));
  if (!base) return undefined;
  const merged: ServerBook = {
    ...base,
    views: base.views ?? 0,
    createdAt: base.createdAt ?? "2026-01-01T00:00:00.000Z",
    ...withGenres(base, patch),
    updatedAt: new Date().toISOString(),
  };
  user.unshift(merged);
  await writeUserBooks(user);
  return merged;
}

export async function softDeleteBook(id: string) {
  return patchBook(id, { deleted: true });
}

export async function incrementViews(id: string) {
  // счётчик просмотров не считается правкой книги — updatedAt не трогаем
  await withLock("user-books", async () => {
    const user = await readUserBooks();
    const idx = user.findIndex((b) => String(b.id) === String(id));
    if (idx >= 0) {
      user[idx] = { ...user[idx], views: (user[idx].views ?? 0) + 1 };
      await writeUserBooks(user);
      return;
    }
    const base = (await readCatalog()).find((b) => String(b.id) === String(id));
    if (!base) return;
    user.unshift({
      ...base,
      views: (base.views ?? 0) + 1,
      createdAt: base.createdAt ?? "2026-01-01T00:00:00.000Z",
    });
    await writeUserBooks(user);
  });
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