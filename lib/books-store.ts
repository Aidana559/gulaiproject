import { promises as fs } from "fs";
import path from "path";
import type { Book, Category, Status } from "@/data/books";
import { readJson, writeJson, uid } from "./db";

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
  deleted?: boolean;
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

/** Все жанры книги (для старых записей без genres — единственный genre) */
export function genresOf(b: { genre?: string; genres?: string[] }): string[] {
  const list = (b.genres ?? []).filter((x) => x && x !== "—");
  if (list.length) return list;
  return b.genre && b.genre !== "—" ? [b.genre] : [];
}

async function readUserBooks(): Promise<ServerBook[]> {
  return readJson<ServerBook[]>(USER_FILE, []);
}

async function writeUserBooks(list: ServerBook[]) {
  await writeJson(USER_FILE, list);
}

export async function getAllBooks(opts: { includeHidden?: boolean } = {}): Promise<ServerBook[]> {
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

  return Array.from(byId.values()).filter(
    (b) => !b.deleted && (opts.includeHidden || !b.hidden),
  );
}

export async function getBook(
  id: string,
  opts: { includeHidden?: boolean } = {},
): Promise<ServerBook | undefined> {
  const all = await getAllBooks({ includeHidden: true });
  const book = all.find((b) => String(b.id) === String(id));
  if (!book || book.deleted) return undefined;
  if (book.hidden && !opts.includeHidden) return undefined;
  return book;
}

export type ListQuery = {
  q?: string;
  category?: string;
  genre?: string;
  author?: string;
  year?: number;
  status?: string;
  sort?: "title" | "new" | "popular";
  page?: number;
  limit?: number;
  includeHidden?: boolean;
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

export async function listBooks(query: ListQuery): Promise<ListResult> {
  let list = await getAllBooks({ includeHidden: query.includeHidden });

  const q = (query.q ?? "").trim().toLowerCase();
  if (q) {
    list = list.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q),
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

  if (query.genre && query.genre !== "all") {
    const wanted = query.genre;
    list = list.filter((b) => genresOf(b).includes(wanted));
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
  genre?: string;
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

export async function createBook(input: CreateBookInput): Promise<ServerBook> {
  const user = await readUserBooks();
  const all = await getAllBooks({ includeHidden: true });
  const maxNum = all.reduce((m, b) => {
    const n = Number(b.id);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 1000);
  const id = maxNum + 1;

  const book: ServerBook = {
    id,
    title: input.title.trim(),
    author: input.author.trim(),
    category: input.category,
    genre: (input.genre ?? "").trim() || "—",
    genres: (input.genre ?? "").trim() ? [(input.genre ?? "").trim()] : [],
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
    createdAt: new Date().toISOString(),
    hidden: false,
    deleted: false,
  };

  user.unshift(book);
  await writeUserBooks(user);
  return book;
}

/** Если сменили основной жанр — список жанров подстраиваем, не теряя остальные */
function withGenres(current: ServerBook, patch: Partial<ServerBook>): Partial<ServerBook> {
  if (typeof patch.genre !== "string" || patch.genres) return patch;
  const list = genresOf(current);
  if (list.includes(patch.genre)) {
    return { ...patch, genres: [patch.genre, ...list.filter((g) => g !== patch.genre)] };
  }
  return { ...patch, genres: patch.genre && patch.genre !== "—" ? [patch.genre] : [] };
}

export async function patchBook(
  id: string,
  patch: Partial<ServerBook>,
): Promise<ServerBook | undefined> {
  const user = await readUserBooks();
  const idx = user.findIndex((b) => String(b.id) === String(id));

  if (idx >= 0) {
    user[idx] = { ...user[idx], ...withGenres(user[idx], patch) };
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
  };
  user.unshift(merged);
  await writeUserBooks(user);
  return merged;
}

export async function softDeleteBook(id: string) {
  return patchBook(id, { deleted: true });
}

export async function incrementViews(id: string) {
  const book = await getBook(id, { includeHidden: true });
  if (!book) return;
  await patchBook(id, { views: (book.views ?? 0) + 1 });
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