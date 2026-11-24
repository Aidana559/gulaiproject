// Единый источник правды по категориям (тип издания) и жанрам. Без серверных импортов — работает и на клиенте.
//
// Категория — тип издания (по умолчанию 4: book | textbook | guide | manga; администратор может добавлять, переименовывать и удалять).
// Жанр — свободная метка книги; у книги их может быть несколько.
//
// Приведение к единому формату НЕ переписывает данные: старые записи нормализуются при чтении (genresOf,
// normalizeCategory), поэтому у уже опубликованных объявлений категории и жанры сохраняются и нигде не теряются.

/** Ключ категории. Встроенные: book | textbook | guide | manga; остальные добавляет администратор. */
export type Category = string;

export type CategoryDef = {
  key: string;
  /** во множественном числе: для фильтров каталога и сводок */
  label: string;
  /** в единственном числе: для форм и карточек */
  singular: string;
};

/** Категории по умолчанию (используются, пока администратор ничего не менял). */
export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { key: "book", label: "Книги", singular: "Книга" },
  { key: "textbook", label: "Учебники", singular: "Учебник" },
  { key: "guide", label: "Методички", singular: "Методичка" },
  { key: "manga", label: "Манга", singular: "Манга" },
];

// Реестр категорий. Заполняется из data/taxonomy.json (сервер: lib/taxonomy-store.ts, клиент: TaxonomyProvider).
let registry: CategoryDef[] = DEFAULT_CATEGORIES;
export const setCategoryRegistry = (list: CategoryDef[]) => {
  if (Array.isArray(list) && list.length) registry = list;
};
export const getCategories = (): CategoryDef[] => registry;
export const getCategoryKeys = (): string[] => registry.map((c) => c.key);

/** Подпись для неизвестного ключа (категория удалена или ещё не загрузилась): показываем ключ как есть. */
const labelFor = (key: string, plural: boolean) => {
  const c = registry.find((x) => x.key === key);
  return c ? (plural ? c.label : c.singular) : DEFAULT_CATEGORIES.find((x) => x.key === key)?.[plural ? "label" : "singular"];
};

function labelsProxy(plural: boolean): Record<string, string> {
  return new Proxy({} as Record<string, string>, {
    get: (_t, prop) => (typeof prop === "string" ? labelFor(prop, plural) : undefined),
    has: (_t, prop) => typeof prop === "string" && registry.some((c) => c.key === prop),
    ownKeys: () => registry.map((c) => c.key),
    getOwnPropertyDescriptor: (_t, prop) =>
      typeof prop === "string" && registry.some((c) => c.key === prop)
        ? { enumerable: true, configurable: true, value: labelFor(prop, plural) }
        : undefined,
  });
}

/** Название во множественном числе — для фильтров каталога и сводок. */
export const categoryLabels: Record<string, string> = labelsProxy(true);

/** Название в единственном числе — для форм добавления и редактирования, карточек. */
export const categoryLabelsSingular: Record<string, string> = labelsProxy(false);

const CATEGORY_ALIASES: Record<string, string> = {
  book: "book",
  books: "book",
  книга: "book",
  книги: "book",
  textbook: "textbook",
  textbooks: "textbook",
  учебник: "textbook",
  учебники: "textbook",
  guide: "guide",
  guides: "guide",
  методичка: "guide",
  методички: "guide",
  методическое: "guide",
  manga: "manga",
  манга: "manga",
};

export const isCategory = (v: unknown): v is Category => typeof v === "string" && registry.some((c) => c.key === v);

/** Приводит значение категории (в т.ч. старое или написанное по-русски) к ключу существующей категории; иначе null. */
export function parseCategory(v: unknown): Category | null {
  if (isCategory(v)) return v;
  const k = String(v ?? "").trim().toLowerCase();
  if (!k) return null;
  const byLabel = registry.find((c) => c.label.toLowerCase() === k || c.singular.toLowerCase() === k);
  if (byLabel) return byLabel.key;
  const alias = CATEGORY_ALIASES[k];
  return alias && isCategory(alias) ? alias : null;
}

/** Как parseCategory, но для отображения: неизвестное значение показываем как первую категорию, данные при этом не меняются. */
export const normalizeCategory = (v: unknown): Category => parseCategory(v) ?? registry[0]?.key ?? "book";

// ---------------- жанры ----------------

/** Канонический список жанров (единый формат: с заглавной буквы, по-русски, без повторов). */
export const CANONICAL_GENRES: string[] = [
  "Антиутопия",
  "Биология",
  "Детектив",
  "Инженерия",
  "Информатика",
  "История",
  "Классика",
  "Математика",
  "Наука",
  "Оформление",
  "Приключения",
  "Роман",
  "Саморазвитие",
  "Сказка",
  "Сёдзё",
  "Сёнэн",
  "Сэйнэн",
  "Триллер",
  "Тёмное фэнтези",
  "Фантастика",
  "Физика",
  "Фэнтези",
  "Художественная литература",
  "Химия",
  "Хоррор",
  "Экономика",
  "Экшен",
  "Языки",
].sort((a, b) => a.localeCompare(b, "ru"));

/** Ключ сравнения: без регистра, ё = е, без знаков препинания и лишних пробелов. */
export function genreKey(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .trim();
}

// Синонимы и частые варианты написания → канонический жанр (ключи — в виде genreKey).
const ALIAS_SOURCE: Record<string, string[]> = {
  Антиутопия: ["дистопия", "антиутопии", "dystopia"],
  Биология: ["биологи"],
  Детектив: ["детективы", "детективная литература", "mystery", "detective", "crime"],
  Инженерия: ["инженерное дело", "технические науки", "техника", "engineering"],
  Информатика: ["программирование", "компьютерные науки", "ит", "it", "computer science", "информационные технологии"],
  История: ["исторический", "историческая литература", "history", "тарих"],
  Классика: ["классическая литература", "классика литературы", "classic", "classics"],
  Математика: ["матем", "математические науки", "mathematics", "math"],
  Наука: ["научная литература", "научно популярное", "науки", "science"],
  Оформление: ["дизайн", "оформительское дело"],
  Приключения: ["приключение", "приключенческий", "приключенческая литература", "adventure"],
  Роман: ["романы", "романтика", "romance", "novel"],
  Саморазвитие: ["самосовершенствование", "личностный рост", "self help", "самопомощь"],
  Сказка: ["сказки", "ертегі", "fairy tale"],
  Сёдзё: ["седзе", "сёдзе", "седзё", "сенсей", "shoujo", "shojo"],
  Сёнэн: ["сёнен", "сенен", "сэнэн", "шонен", "сёнэн", "shounen", "shonen"],
  Сэйнэн: ["сейнен", "сэйнен", "сейнэн", "seinen"],
  Триллер: ["триллеры", "thriller", "suspense"],
  "Тёмное фэнтези": ["темное фэнтези", "тёмное фентези", "темное фентези", "тёмное фэнтэзи", "темное фэнтэзи", "dark fantasy"],
  Фантастика: ["научная фантастика", "фантастические", "sci fi", "scifi", "science fiction", "нф"],
  Физика: ["физические науки", "physics"],
  Фэнтези: ["фентези", "фэнтэзи", "фентэзи", "fantasy"],
  "Художественная литература": ["художественная", "худ литература", "художественная проза", "проза", "fiction", "художественные книги"],
  Химия: ["химические науки", "chemistry"],
  Хоррор: ["ужасы", "ужас", "horror", "страшилки"],
  Экономика: ["экономические науки", "бизнес", "финансы", "economics", "business"],
  Экшен: ["экшн", "боевик", "боевики", "action", "экшен манга"],
  Языки: ["иностранные языки", "языкознание", "лингвистика", "английский язык", "languages"],
};

let GENRE_ALIASES = new Map<string, string>();

/**
 * Пересобирает таблицу жанров. Список жанров задаёт администратор: известны только жанры из списка,
 * синонимы работают лишь для жанров, которые в нём есть (удалённый или переименованный жанр больше не «воскресает»).
 */
export function setGenreRegistry(names: string[]) {
  const canon = Array.isArray(names) ? names : CANONICAL_GENRES;
  const m = new Map<string, string>();
  for (const g of canon) m.set(genreKey(g), g);
  const have = new Set(canon);
  for (const [c, list] of Object.entries(ALIAS_SOURCE)) {
    if (!have.has(c)) continue;
    for (const a of list) if (!m.has(genreKey(a))) m.set(genreKey(a), c);
  }
  GENRE_ALIASES = m;
}
setGenreRegistry(CANONICAL_GENRES);

/**
 * Единый формат названия жанра:
 *  • известные жанры и их синонимы → каноническое название из списка;
 *  • прочее: пробелы схлопнуты, первая буква заглавная, остальное как введено
 *    (КАПСОМ набранные слова длиннее 4 букв приводятся к обычному регистру).
 * Пустое значение и «—» дают пустую строку.
 */
export function normalizeGenreName(raw: unknown): string {
  let s = String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (!s || s === "—" || s === "-") return "";
  const hit = GENRE_ALIASES.get(genreKey(s));
  if (hit) return hit;
  if (s.length > 4 && s === s.toUpperCase() && s !== s.toLowerCase()) s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Список жанров в едином формате, без пустых и повторов (порядок сохраняется). */
export function normalizeGenreList(input: unknown, max = 12): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const g = normalizeGenreName(x);
    if (!g) continue;
    const k = genreKey(g);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(g);
    if (out.length >= max) break;
  }
  return out;
}

/** Совпадают ли два названия жанра (с учётом синонимов и регистра). */
export const sameGenre = (a: unknown, b: unknown) => genreKey(normalizeGenreName(a)) === genreKey(normalizeGenreName(b));
