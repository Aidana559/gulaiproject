// Единый источник правды по категориям (тип издания) и жанрам. Без серверных импортов — работает и на клиенте.
//
// Категория — тип издания (фиксированный список из 4 значений, хранится в книге как book | textbook | guide | manga).
// Жанр — свободная метка книги; у книги их может быть несколько.
//
// Приведение к единому формату НЕ переписывает данные: старые записи нормализуются при чтении (genresOf,
// normalizeCategory), поэтому у уже опубликованных объявлений категории и жанры сохраняются и нигде не теряются.

export type Category = "book" | "textbook" | "guide" | "manga";

export const CATEGORIES: Category[] = ["book", "textbook", "guide", "manga"];

/** Название во множественном числе — для фильтров каталога и сводок. */
export const categoryLabels: Record<Category, string> = {
  book: "Книги",
  textbook: "Учебники",
  guide: "Методички",
  manga: "Манга",
};

/** Название в единственном числе — для форм добавления и редактирования, карточек. */
export const categoryLabelsSingular: Record<Category, string> = {
  book: "Книга",
  textbook: "Учебник",
  guide: "Методичка",
  manga: "Манга",
};

const CATEGORY_ALIASES: Record<string, Category> = {
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

export const isCategory = (v: unknown): v is Category => typeof v === "string" && (CATEGORIES as string[]).includes(v);

/** Приводит значение категории (в т.ч. старое или написанное по-русски) к одному из 4 ключей; иначе null. */
export function parseCategory(v: unknown): Category | null {
  if (isCategory(v)) return v;
  const k = String(v ?? "").trim().toLowerCase();
  return CATEGORY_ALIASES[k] ?? null;
}

/** Как parseCategory, но для отображения: неизвестное значение показываем как «Книга», данные при этом не меняются. */
export const normalizeCategory = (v: unknown): Category => parseCategory(v) ?? "book";

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

const GENRE_ALIASES = new Map<string, string>();
for (const g of CANONICAL_GENRES) GENRE_ALIASES.set(genreKey(g), g);
for (const [canon, list] of Object.entries(ALIAS_SOURCE)) for (const a of list) GENRE_ALIASES.set(genreKey(a), canon);

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
