

export type Category = string;

export type CategoryDef = {
  key: string;

  label: string;

  singular: string;

  icon?: string;
  poster?: string;
};


export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { poster: "/category-covers/book.webp", key: "book", label: "Книги", singular: "Книга", icon: "book" },
  { poster: "/category-covers/textbook.webp", key: "textbook", label: "Учебники", singular: "Учебник", icon: "graduation" },
  { poster: "/category-covers/guide.webp", key: "guide", label: "Методички", singular: "Методичка", icon: "file-text" },
  { poster: "/category-covers/manga.webp", key: "manga", label: "Манга", singular: "Манга", icon: "layers" },
];


export function categoryPoster(c: CategoryDef): string | undefined {
  return c.poster || DEFAULT_CATEGORIES.find((d) => d.key === c.key)?.poster;
}

let registry: CategoryDef[] = DEFAULT_CATEGORIES;
export const setCategoryRegistry = (list: CategoryDef[]) => {
  if (Array.isArray(list) && list.length) registry = list;
};
export const getCategories = (): CategoryDef[] => registry;
export const getCategoryKeys = (): string[] => registry.map((c) => c.key);


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


export const categoryLabels: Record<string, string> = labelsProxy(true);


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


export function parseCategory(v: unknown): Category | null {
  if (isCategory(v)) return v;
  const k = String(v ?? "").trim().toLowerCase();
  if (!k) return null;
  const byLabel = registry.find((c) => c.label.toLowerCase() === k || c.singular.toLowerCase() === k);
  if (byLabel) return byLabel.key;
  const alias = CATEGORY_ALIASES[k];
  return alias && isCategory(alias) ? alias : null;
}


export const normalizeCategory = (v: unknown): Category => parseCategory(v) ?? registry[0]?.key ?? "book";



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


export function genreKey(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .trim();
}

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


export function normalizeGenreName(raw: unknown): string {
  let s = String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (!s || s === "—" || s === "-") return "";
  const hit = GENRE_ALIASES.get(genreKey(s));
  if (hit) return hit;
  if (s.length > 4 && s === s.toUpperCase() && s !== s.toLowerCase()) s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}


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


export const sameGenre = (a: unknown, b: unknown) => genreKey(normalizeGenreName(a)) === genreKey(normalizeGenreName(b));
