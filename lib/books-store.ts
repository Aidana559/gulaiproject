import { promises as fs } from "fs";
import path from "path";
import type { Book, Status } from "@/data/books";
import { categoryLabels, categoryLabelsSingular, normalizeCategory, normalizeGenreList, parseCategory, sameGenre, type Category } from "./categories";
import { readJson, readJsonShared, writeJson, uid, withLock } from "./db";
import { MAX_GENRES, bookState } from "./moderation-shared";
import { genresOf } from "./genres";
import { getBookStates } from "./bookings";
import { getTaxonomy } from "./taxonomy-store";

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

/** Каталог только для чтения (общий экземпляр из кэша, не менять!). */
async function readCatalog(): Promise<ServerBook[]> {
  return readJsonShared<ServerBook[]>(CATALOG_FILE, []);
}

export { genresOf };

function canonBook(b: ServerBook): ServerBook {
  const category = normalizeCategory(b.category);
  const genres = genresOf(b);
  const sameGenres = Array.isArray(b.genres) && b.genres.length === genres.length && b.genres.every((g, i) => g === genres[i]);
  if (category === b.category && sameGenres && (b.genre === (genres[0] ?? "—") || (!b.genre && !genres.length))) return b;
  return { ...b, category, genres, genre: genres[0] ?? "—" };
}

/**
 * Приводит список жанров к чистому виду: без пустых, «—» и повторов (без учёта регистра),
 * не больше MAX_GENRES. Книга ↔ жанры — связь «многие ко многим»: у книги список жанров,
 * одна и та же запись жанра может быть у любого числа книг.
 */
export function normalizeGenres(input: unknown): string[] {
  // единый формат названий (lib/categories.ts): синонимы и регистр сводятся к одному жанру
  return normalizeGenreList(input, MAX_GENRES);
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

/**
 * Объявление пользователя ещё не одобрено модератором — в публичном каталоге и для брони
 * не должно быть видно. Книги каталога (без ownerId) всегда «опубликованы».
 */
export function isPendingReview(b: {
  ownerId?: string | number | null;
  reviewed?: boolean;
  deleted?: boolean;
}): boolean {
  if (b.deleted) return false;
  if (b.ownerId == null || b.ownerId === "") return false;
  return !b.reviewed;
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
  // оба файла читаются параллельно и из кэша; ниже данные только фильтруются (копии объектов создаются через spread)
  // getTaxonomy заодно обновляет реестр категорий и жанров (из data/taxonomy.json), по которому приводятся данные книг
  const [user, catalog] = await Promise.all([
    readJsonShared<ServerBook[]>(USER_FILE, []),
    readCatalog(),
    getTaxonomy(),
  ]).then(([u, c]) => [u, c] as const);
  const staticMapped: ServerBook[] = catalog.map((b) => ({
    ...b,
    ownerId: undefined,
    views: b.views ?? 0,
    createdAt: b.createdAt ?? "2026-01-01T00:00:00.000Z",
  }));


  const byId = new Map<string, ServerBook>();
  for (const b of staticMapped) byId.set(String(b.id), b);
  for (const b of user) byId.set(String(b.id), { ...b }); // копия: объект из кэша менять нельзя

  const now = Date.now();
  // Категория и жанры приводятся к единому формату только при чтении: файлы с данными не переписываются,
  // поэтому категории уже опубликованных объявлений не теряются, а повторы и разные написания сводятся в одно.
  // includeHidden=false — публичный каталог: без скрытых и без ещё не одобренных объявлений.
  return Array.from(byId.values()).map(canonBook).filter(
    (b) =>
      (opts.includeDeleted || !b.deleted) &&
      (opts.includeHidden || (!isHiddenNow(b, now) && !isPendingReview(b))),
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
  if (!opts.includeHidden && (isHiddenNow(book) || isPendingReview(book))) return undefined;
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

// Один экземпляр на процесс: localeCompare("ru") без него создаёт новый коллатор при каждом сравнении
const RU = new Intl.Collator("ru");

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
    // …и по названию категории («манга», «учебник», «методички»)
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
    // неизвестная категория в запросе — пустая выдача, а не «все книги»
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

  // жанры для фильтра: по книгам выбранной категории/поиска, до применения самого жанра
  const genreFacet = Array.from(new Set(list.flatMap((b) => genresOf(b)))).sort(RU.compare);

  const wantedGenres = (Array.isArray(query.genre) ? query.genre : [query.genre ?? ""])
    .map((g) => g.trim())
    .filter((g) => g && g !== "all");
  if (wantedGenres.length) {
    // книга попадает в выдачу, если у неё есть каждый из выбранных жанров
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

/**
 * Самый большой номер книги, на который ссылаются другие файлы (брони, журнал модерации, жалобы, отзывы).
 * Даже если сама книга пропала из user-books.json, её номер нельзя выдавать новой книге: иначе старые брони,
 * записи журнала и переписки «прилипнут» к чужой книге. Файлы только читаются.
 */
async function maxReferencedBookNumber(): Promise<number> {
  let max = 0;
  const bump = (v: unknown) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > max) max = n;
  };
  type Ref = { bookId?: unknown; targetType?: string; targetId?: unknown };
  for (const file of ["bookings.json", "moderation-log.json", "reports.json", "reviews.json"]) {
    for (const r of await readJson<Ref[]>(file, [])) {
      bump(r.bookId);
      if (r.targetType === "book") bump(r.targetId);
    }
  }
  return max;
}

async function createBookUnlocked(input: CreateBookInput): Promise<ServerBook> {
  const user = await readUserBooks();
  // удалённые тоже учитываем, чтобы id никогда не повторялся
  const all = await getAllBooks({ includeHidden: true, includeDeleted: true });
  const referenced = await maxReferencedBookNumber();
  const maxNum = all.reduce((m, b) => {
    const n = Number(b.id);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, Math.max(1000, referenced));
  const id = maxNum + 1;

  const title = input.title.trim();
  const author = input.author.trim();
  if (title.length < 2) throw new Error("Укажите название (не короче 2 символов)");
  if (title.length > 200) throw new Error("Название слишком длинное (макс. 200 символов)");
  if (author.length < 2) throw new Error("Укажите автора (не короче 2 символов)");
  if (author.length > 200) throw new Error("Имя автора слишком длинное (макс. 200 символов)");
  const description = (input.description ?? "").trim();
  if (description.length > 5000) throw new Error("Описание слишком длинное (макс. 5000 символов)");

  // Дубликат: у того же владельца уже есть неудалённое объявление с тем же названием и автором
  const tKey = title.toLowerCase().replace(/ё/g, "е");
  const aKey = author.toLowerCase().replace(/ё/g, "е");
  const dup = all.find(
    (b) =>
      !b.deleted &&
      String(b.ownerId) === String(input.ownerId) &&
      (b.title ?? "").trim().toLowerCase().replace(/ё/g, "е") === tKey &&
      (b.author ?? "").trim().toLowerCase().replace(/ё/g, "е") === aKey,
  );
  if (dup) {
    throw new Error(
      `У вас уже есть объявление «${dup.title}» (id ${dup.id}). Отредактируйте существующее или удалите его.`,
    );
  }

  const genres = normalizeGenres(input.genres ?? input.genre);
  const now = new Date().toISOString();

  const book: ServerBook = {
    id,
    title,
    author,
    category: input.category,
    genre: genres[0] ?? "—",
    genres,
    year: input.year || new Date().getFullYear(),
    pages: input.pages || 0,
    city: (input.city ?? "").trim() || "—",
    campus: (input.campus ?? "").trim() || undefined,
    description,
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

// Счётчик просмотров копится в памяти и записывается пачкой раз в VIEWS_FLUSH_MS.
// Раньше каждый просмотр книги перезаписывал весь user-books.json (запись + fsync + rename на каждый GET).
// Если процесс остановится, потеряются просмотры максимум за последние несколько секунд.
const VIEWS_FLUSH_MS = 5000;
const pendingViews = new Map<string, number>();
let viewsTimer: ReturnType<typeof setTimeout> | null = null;

async function flushViews() {
  if (pendingViews.size === 0) return;
  const batch = new Map(pendingViews);
  pendingViews.clear();
  try {
    await withLock("user-books", async () => {
      const user = await readUserBooks();
      const catalog = await readCatalog();
      let changed = false;
      for (const [id, n] of batch) {
        const idx = user.findIndex((b) => String(b.id) === id);
        if (idx >= 0) {
          user[idx] = { ...user[idx], views: (user[idx].views ?? 0) + n };
          changed = true;
          continue;
        }
        const base = catalog.find((b) => String(b.id) === id);
        if (!base) continue;
        user.unshift({
          ...base,
          views: (base.views ?? 0) + n,
          createdAt: base.createdAt ?? "2026-01-01T00:00:00.000Z",
        });
        changed = true;
      }
      if (changed) await writeUserBooks(user);
    });
  } catch {
    // не получилось записать — возвращаем счётчики, попробуем в следующий раз
    for (const [id, n] of batch) pendingViews.set(id, (pendingViews.get(id) ?? 0) + n);
  }
}

export async function incrementViews(id: string) {
  // счётчик просмотров не считается правкой книги — updatedAt не трогаем
  const key = String(id);
  pendingViews.set(key, (pendingViews.get(key) ?? 0) + 1);
  if (!viewsTimer) {
    viewsTimer = setTimeout(() => {
      viewsTimer = null;
      void flushViews();
    }, VIEWS_FLUSH_MS);
    viewsTimer.unref?.();
  }
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