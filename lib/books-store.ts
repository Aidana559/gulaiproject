import { promises as fs } from "fs";
import path from "path";
import { books as staticBooks, type Book, type Category, type Status } from "@/data/books";
import { readJson, writeJson, uid } from "./db";

/** Состояние экземпляра */
export type Condition = "new" | "used" | "annotated";

export const conditionLabels: Record<Condition, string> = {
  new: "Новая",
  used: "Б/у",
  annotated: "С пометками",
};

/** Полная модель книги на сервере (статика + user-books) */
export type ServerBook = Book & {
  ownerId?: string;
  isbn?: string;
  condition?: Condition;
  campus?: string; // корпус / общежитие
  coverUrl?: string | null;
  views?: number;
  createdAt?: string;
  hidden?: boolean;
  deleted?: boolean;
};

const USER_FILE = "user-books.json";
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

async function readUserBooks(): Promise<ServerBook[]> {
  return readJson<ServerBook[]>(USER_FILE, []);
}

async function writeUserBooks(list: ServerBook[]) {
  await writeJson(USER_FILE, list);
}

/** Статика + пользовательские, без удалённых */
export async function getAllBooks(opts: { includeHidden?: boolean } = {}): Promise<ServerBook[]> {
  const user = await readUserBooks();
  const staticMapped: ServerBook[] = staticBooks.map((b) => ({
    ...b,
    ownerId: undefined,
    views: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  }));

  // user books override same id if ever collide; user first in list for «новые»
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
  status?: string;
  sort?: "title" | "new" | "popular";
  page?: number;
  limit?: number;
  includeHidden?: boolean;
};

export type ListResult = {
  books: ServerBook[];
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
        b.author.toLowerCase().includes(q) ||
        (b.isbn && b.isbn.toLowerCase().includes(q)),
    );
  }
  if (query.category && query.category !== "all") {
    list = list.filter((b) => b.category === query.category);
  }
  if (query.genre && query.genre !== "all") {
    list = list.filter((b) => b.genre === query.genre);
  }
  if (query.status && query.status !== "all") {
    list = list.filter((b) => b.status === query.status);
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

  return { books, total, page, limit, pages };
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
  isbn?: string;
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
    year: input.year || new Date().getFullYear(),
    pages: input.pages || 0,
    city: (input.city ?? "").trim() || "—",
    campus: (input.campus ?? "").trim() || undefined,
    description: (input.description ?? "").trim() || "",
    isbn: (input.isbn ?? "").trim() || undefined,
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

export async function patchBook(
  id: string,
  patch: Partial<ServerBook>,
): Promise<ServerBook | undefined> {
  const user = await readUserBooks();
  const idx = user.findIndex((b) => String(b.id) === String(id));

  if (idx >= 0) {
    user[idx] = { ...user[idx], ...patch };
    await writeUserBooks(user);
    return user[idx];
  }

  // статическая книга — сохраняем как user-override копию
  const base = staticBooks.find((b) => String(b.id) === String(id));
  if (!base) return undefined;
  const merged: ServerBook = {
    ...base,
    views: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...patch,
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

/** Сохранить обложку: JPG/PNG/WebP, ≤ 5 МБ → /public/uploads/... */
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
