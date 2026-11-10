import type { Category } from "@/data/books";

/**
 * План наполнения каталога.
 *
 * Здесь НЕТ данных о книгах — только «что искать» в Google Books и как проверить,
 * что найден именно нужный том. Название, авторы, обложка, описание, ISBN, год и
 * число страниц берутся из ответа Google Books API (lib/catalog-loader.ts).
 *
 * Слот = одна книга (или несколько, если take > 1). Слоты перебираются по порядку,
 * пока в категории не наберётся нужное количество книг, поэтому в конце каждого
 * списка стоят запасные варианты на случай, если что-то не нашлось.
 */
export type Slot = {
  /** запрос к Google Books (основной) */
  q: string;
  /** запрос для поиска без ограничения языка (по умолчанию = q) */
  qEn?: string;
  /**
   * ru-first — сначала только русские издания, затем любые (по умолчанию)
   * ru       — только русские издания
   * any      — любые издания
   */
  mode?: "ru-first" | "ru" | "any";
  /** найденная книга должна содержать хотя бы один из этих фрагментов в названии */
  titleAny: string[];
  /** …и не содержать ни одного из этих */
  titleNone?: string[];
  /** регулярное выражение для названия (например, «том 1») */
  titleRe?: string;
  /** хотя бы один из фрагментов должен встретиться среди авторов */
  authorAny?: string[];
  /** жанры книги (первый — основной) */
  genres: string[];
  /** сколько книг брать по этому запросу (по умолчанию 1) */
  take?: number;
};

/** Сколько книг в каждой категории (примерно по 10) */
export const CATEGORY_TARGET: Record<Category, number> = {
  book: 12,
  textbook: 10,
  guide: 10,
  manga: 12,
};

/**
 * Фиксированные id книг по категориям. Транзакции и брони ссылаются на эти id
 * (1–42), поэтому книги каталога занимают их же — и записи в транзакциях
 * показывают книги из каталога. Если id в диапазоне кончились — берём 2001+.
 */
export const ID_POOLS: Record<Category, number[]> = {
  book: range(1, 12),
  textbook: range(13, 22),
  guide: [...range(23, 30), 43, 44],
  manga: range(31, 42),
};

function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const MANGA_NONE = [
  "omnibus",
  "box set",
  "boxset",
  "3-in-1",
  "2-in-1",
  "collector",
  "art book",
  "artbook",
  "guidebook",
  "novel",
  "anime",
  "coloring",
];

export const catalogPlan: Record<Category, Slot[]> = {
  // ───────────────────────── Книги ─────────────────────────
  book: [
    {
      q: 'intitle:"Мастер и Маргарита" inauthor:Булгаков',
      qEn: 'intitle:"The Master and Margarita" inauthor:Bulgakov',
      titleAny: ["мастер и маргарита", "master and margarita"],
      authorAny: ["булгаков", "bulgakov"],
      genres: ["Классика", "Роман", "Фэнтези"],
    },
    {
      q: 'intitle:"Преступление и наказание" inauthor:Достоевский',
      qEn: 'intitle:"Crime and Punishment" inauthor:Dostoevsky',
      titleAny: ["преступление и наказание", "crime and punishment"],
      authorAny: ["достоевск", "dostoevsk", "dostoyevsk"],
      genres: ["Классика", "Роман"],
    },
    {
      q: "intitle:1984 inauthor:Оруэлл",
      qEn: "intitle:1984 inauthor:Orwell",
      titleAny: ["1984", "nineteen eighty-four"],
      titleNone: ["animal farm", "скотный"],
      authorAny: ["оруэлл", "orwell"],
      genres: ["Антиутопия", "Фантастика", "Классика"],
    },
    {
      q: 'intitle:"Маленький принц" inauthor:Экзюпери',
      qEn: 'intitle:"The Little Prince" inauthor:Saint-Exupéry',
      titleAny: ["маленький принц", "little prince", "petit prince"],
      authorAny: ["экзюпери", "exup"],
      genres: ["Сказка", "Классика"],
    },
    {
      q: 'intitle:"Гарри Поттер и философский камень" inauthor:Роулинг',
      qEn: 'intitle:"Harry Potter and the Sorcerer\'s Stone" inauthor:Rowling',
      titleAny: ["философск", "philosopher", "sorcerer"],
      authorAny: ["роулинг", "rowling"],
      genres: ["Фэнтези", "Приключения"],
    },
    {
      q: 'intitle:"Властелин колец" "Братство Кольца" inauthor:Толкин',
      qEn: 'intitle:"The Fellowship of the Ring" inauthor:Tolkien',
      titleAny: ["братство кольца", "fellowship of the ring", "властелин колец"],
      titleNone: ["return of the king", "two towers", "возвращение короля", "две крепости"],
      authorAny: ["толкин", "толкиен", "tolkien"],
      genres: ["Фэнтези", "Приключения", "Классика"],
    },
    {
      q: "intitle:Дюна inauthor:Герберт",
      qEn: "intitle:Dune inauthor:Herbert",
      titleAny: ["дюна", "dune"],
      titleNone: ["messiah", "мессия", "children", "дети дюны", "god emperor", "chapterhouse", "heretics", "cookbook"],
      authorAny: ["герберт", "herbert"],
      genres: ["Фантастика"],
    },
    {
      q: 'intitle:"Убийство в Восточном экспрессе" inauthor:Кристи',
      qEn: 'intitle:"Murder on the Orient Express" inauthor:Christie',
      titleAny: ["восточном экспрессе", "orient express"],
      authorAny: ["кристи", "christie"],
      genres: ["Детектив", "Классика"],
    },
    {
      q: 'intitle:"Над пропастью во ржи" inauthor:Сэлинджер',
      qEn: 'intitle:"The Catcher in the Rye" inauthor:Salinger',
      titleAny: ["над пропастью", "catcher in the rye"],
      authorAny: ["сэлинджер", "селинджер", "salinger"],
      genres: ["Классика", "Роман"],
    },
    {
      q: 'intitle:"Остров сокровищ" inauthor:Стивенсон',
      qEn: 'intitle:"Treasure Island" inauthor:Stevenson',
      titleAny: ["остров сокровищ", "treasure island"],
      authorAny: ["стивенсон", "stevenson"],
      genres: ["Приключения", "Классика"],
    },
    // запасные
    {
      q: 'intitle:"451 градус по Фаренгейту" inauthor:Брэдбери',
      qEn: 'intitle:"Fahrenheit 451" inauthor:Bradbury',
      titleAny: ["451", "фаренгейт", "fahrenheit"],
      authorAny: ["брэдбери", "бредбери", "bradbury"],
      genres: ["Антиутопия", "Фантастика"],
    },
    {
      q: 'intitle:"Собачье сердце" inauthor:Булгаков',
      qEn: 'intitle:"Heart of a Dog" inauthor:Bulgakov',
      titleAny: ["собачье сердце", "heart of a dog"],
      authorAny: ["булгаков", "bulgakov"],
      genres: ["Классика", "Фантастика"],
    },
    {
      q: "intitle:Хоббит inauthor:Толкин",
      qEn: "intitle:Hobbit inauthor:Tolkien",
      titleAny: ["хоббит", "hobbit"],
      authorAny: ["толкин", "толкиен", "tolkien"],
      genres: ["Фэнтези", "Приключения"],
    },
    {
      q: 'intitle:"Приключения Шерлока Холмса" inauthor:Дойл',
      qEn: 'intitle:"The Adventures of Sherlock Holmes" inauthor:Doyle',
      titleAny: ["шерлока холмса", "sherlock holmes"],
      authorAny: ["дойл", "doyle"],
      genres: ["Детектив", "Классика"],
    },
    {
      q: "intitle:Сияние inauthor:Кинг",
      qEn: "intitle:Shining inauthor:King",
      titleAny: ["сияние", "shining"],
      authorAny: ["кинг", "king"],
      genres: ["Хоррор", "Триллер"],
    },
  ],

  // ───────────────────────── Учебники ─────────────────────────
  textbook: [
    {
      q: "intitle:Алгоритмы построение анализ inauthor:Кормен",
      qEn: 'intitle:"Introduction to Algorithms" inauthor:Cormen',
      titleAny: ["алгоритм", "introduction to algorithms"],
      authorAny: ["кормен", "cormen"],
      genres: ["Информатика", "Математика"],
    },
    {
      q: "intitle:Фейнмановские лекции по физике inauthor:Фейнман",
      qEn: 'intitle:"The Feynman Lectures on Physics" inauthor:Feynman',
      titleAny: ["фейнмановские лекции", "feynman lectures"],
      authorAny: ["фейнман", "feynman"],
      genres: ["Физика"],
    },
    {
      q: 'intitle:"Математический анализ" inauthor:Зорич',
      qEn: 'intitle:"Mathematical Analysis" inauthor:Zorich',
      titleAny: ["математический анализ", "mathematical analysis"],
      authorAny: ["зорич", "zorich"],
      genres: ["Математика"],
    },
    {
      q: 'intitle:"Современные операционные системы" inauthor:Таненбаум',
      qEn: 'intitle:"Modern Operating Systems" inauthor:Tanenbaum',
      titleAny: ["операционные системы", "operating systems"],
      authorAny: ["таненбаум", "tanenbaum"],
      genres: ["Информатика", "Инженерия"],
    },
    {
      q: 'intitle:"Компьютерные сети" inauthor:Таненбаум',
      qEn: 'intitle:"Computer Networks" inauthor:Tanenbaum',
      titleAny: ["компьютерные сети", "computer networks"],
      authorAny: ["таненбаум", "tanenbaum"],
      genres: ["Информатика", "Инженерия"],
    },
    {
      q: 'intitle:"Принципы экономики" inauthor:Мэнкью',
      qEn: 'intitle:"Principles of Economics" inauthor:Mankiw',
      titleAny: ["принципы экономики", "principles of economics"],
      authorAny: ["мэнкью", "манкью", "mankiw"],
      genres: ["Экономика"],
    },
    {
      q: 'intitle:"Грамматика английского языка" inauthor:Мёрфи',
      titleAny: ["грамматика английского", "grammar in use"],
      authorAny: ["мёрфи", "мерфи", "мэрфи", "murphy"],
      genres: ["Языки"],
    },
    {
      q: 'intitle:"Приёмы объектно-ориентированного проектирования" inauthor:Гамма',
      qEn: 'intitle:"Design Patterns" inauthor:Gamma',
      titleAny: ["объектно-ориентированного проектирования", "design patterns"],
      authorAny: ["гамм", "gamma"],
      genres: ["Информатика"],
    },
    {
      q: 'intitle:"Компиляторы: принципы, технологии и инструментарий" inauthor:Ахо',
      qEn: 'intitle:"Compilers: Principles, Techniques, and Tools" inauthor:Aho',
      titleAny: ["компилятор", "compilers"],
      authorAny: ["ахо", "aho"],
      genres: ["Информатика"],
    },
    {
      q: 'intitle:"Общий курс физики" inauthor:Сивухин',
      qEn: 'intitle:"University Physics" inauthor:Young',
      titleAny: ["общий курс физики", "university physics"],
      authorAny: ["сивухин", "young", "янг", "freedman"],
      genres: ["Физика"],
    },
    // запасные
    {
      q: 'intitle:Биология inauthor:Кэмпбелл',
      titleAny: ["биология"],
      authorAny: ["кэмпбелл", "кемпбелл", "рис", "урри", "campbell", "reece"],
      genres: ["Биология"],
    },
    {
      q: 'intitle:"Органическая химия" inauthor:Реутов',
      titleAny: ["органическая химия"],
      authorAny: ["реутов", "травень", "морисон", "керри"],
      genres: ["Химия"],
    },
    {
      q: 'intitle:"Курс общей физики" inauthor:Савельев',
      titleAny: ["курс общей физики", "общий курс физики"],
      authorAny: ["савельев", "сивухин"],
      genres: ["Физика"],
    },
    {
      q: 'intitle:"Искусственный интеллект: современный подход" inauthor:Рассел',
      titleAny: ["искусственный интеллект"],
      authorAny: ["рассел", "норвиг", "russell", "norvig"],
      genres: ["Информатика"],
    },
    {
      q: 'intitle:"Совершенный код" inauthor:Макконнелл',
      titleAny: ["совершенный код"],
      authorAny: ["макконнелл", "mcconnell"],
      genres: ["Информатика"],
    },
    {
      q: 'intitle:"Математический анализ" inauthor:Фихтенгольц',
      titleAny: ["математический анализ", "дифференциального и интегрального исчисления"],
      authorAny: ["фихтенгольц"],
      genres: ["Математика"],
    },
    {
      q: 'intitle:"Чистый код" inauthor:Мартин',
      titleAny: ["чистый код"],
      authorAny: ["мартин", "martin"],
      genres: ["Информатика"],
    },
    {
      q: 'intitle:"Экономикс" inauthor:Макконнелл',
      titleAny: ["экономикс"],
      authorAny: ["макконнелл", "брю"],
      genres: ["Экономика"],
    },
  ],

  // ───────────────────────── Методички ─────────────────────────
  guide: [
    { q: "методическое пособие по высшей математике", mode: "ru", titleAny: ["математик"], genres: ["Математика"], take: 2 },
    { q: "методические указания к лабораторным работам по физике", mode: "ru", titleAny: ["физик"], genres: ["Физика"], take: 2 },
    { q: "методические указания по общей химии практикум", mode: "ru", titleAny: ["хими"], genres: ["Химия"], take: 2 },
    { q: "методическое пособие по программированию", mode: "ru", titleAny: ["программир"], genres: ["Информатика"], take: 2 },
    { q: "методические указания по базам данных практикум", mode: "ru", titleAny: ["баз данн", "базы данн", "sql"], genres: ["Информатика"], take: 2 },
    { q: "методическое пособие по английскому языку", mode: "ru", titleAny: ["английск"], genres: ["Языки"], take: 2 },
    { q: "методические рекомендации по написанию курсовой работы", mode: "ru", titleAny: ["курсов", "дипломн", "письменн", "оформлени"], genres: ["Оформление"], take: 2 },
    { q: "методические указания по экономике практикум", mode: "ru", titleAny: ["экономик"], genres: ["Экономика"], take: 2 },
    { q: "методическое пособие по русскому языку", mode: "ru", titleAny: ["русск"], genres: ["Языки"], take: 2 },
    { q: "методические указания по сопротивлению материалов", mode: "ru", titleAny: ["сопротивлени", "механик"], genres: ["Инженерия"], take: 2 },
    { q: "методические указания по инженерной графике", mode: "ru", titleAny: ["график", "черчени"], genres: ["Инженерия"], take: 2 },
    { q: "методическое пособие по истории", mode: "ru", titleAny: ["истори"], genres: ["История"], take: 2 },
    { q: "методическое пособие по биологии практикум", mode: "ru", titleAny: ["биолог"], genres: ["Биология"], take: 2 },
    { q: "методические указания по информатике", mode: "ru", titleAny: ["информатик"], genres: ["Информатика"], take: 2 },
    { q: "учебно-методическое пособие по физике", mode: "ru", titleAny: ["физик"], genres: ["Физика"], take: 2 },
    { q: "учебно-методическое пособие по математике", mode: "ru", titleAny: ["математик"], genres: ["Математика"], take: 2 },
  ],

  // ───────────────────────── Манга (русские издания) ─────────────────────────
  manga: [
    { q: "intitle:Наруто manga", titleAny: ["наруто"], titleNone: [...MANGA_NONE, "боруто", "ураганные"], genres: ["Сёнэн", "Экшен", "Приключения"] },
    { q: "intitle:Ван-Пис manga", titleAny: ["ван-пис", "ван пис", "one piece"], titleNone: MANGA_NONE, genres: ["Сёнэн", "Приключения", "Экшен"] },
    { q: "intitle:Тетрадь смерти manga", titleAny: ["тетрадь смерти", "death note"], titleNone: [...MANGA_NONE, "another note"], genres: ["Сёнэн", "Триллер", "Детектив"] },
    { q: "intitle:Атака титанов manga", titleAny: ["атака титанов", "attack on titan"], titleNone: [...MANGA_NONE, "before the fall", "junior high", "lost girls"], genres: ["Сёнэн", "Экшен", "Тёмное фэнтези"] },
    { q: "intitle:Берсерк manga Миура", titleAny: ["берсерк", "berserk"], titleNone: MANGA_NONE, genres: ["Сэйнэн", "Тёмное фэнтези", "Хоррор"] },
    { q: "intitle:Токийский гуль manga", titleAny: ["токийский гуль", "tokyo ghoul"], titleNone: MANGA_NONE, genres: ["Сэйнэн", "Хоррор", "Тёмное фэнтези"] },
    { q: "intitle:Моя геройская академия manga", titleAny: ["геройская академия", "my hero academia"], titleNone: MANGA_NONE, genres: ["Сёнэн", "Экшен", "Фантастика"] },
    { q: "intitle:Блич manga Кубо", titleAny: ["блич", "bleach"], titleNone: MANGA_NONE, genres: ["Сёнэн", "Экшен", "Фэнтези"] },
    { q: "intitle:Стальной алхимик manga", titleAny: ["стальной алхимик", "fullmetal alchemist"], titleNone: MANGA_NONE, genres: ["Сёнэн", "Фэнтези", "Приключения"] },
    { q: "intitle:Истребитель демонов manga", titleAny: ["истребитель демонов", "клинок, рассекающий демонов", "kimetsu"], titleNone: MANGA_NONE, genres: ["Сёнэн", "Экшен", "Тёмное фэнтези"] },
    // запасные
    { q: "intitle:Драконий жемчуг manga", titleAny: ["драконий жемчуг", "dragon ball"], titleNone: MANGA_NONE, genres: ["Сёнэн", "Приключения", "Экшен"] },
    { q: "intitle:Человек-бензопила manga", titleAny: ["человек-бензопила", "chainsaw man"], titleNone: MANGA_NONE, genres: ["Сёнэн", "Экшен", "Хоррор"] },
    { q: "intitle:Магическая битва manga", titleAny: ["магическая битва", "jujutsu"], titleNone: MANGA_NONE, genres: ["Сёнэн", "Экшен", "Тёмное фэнтези"] },
    { q: "intitle:Ванпанчмен manga", titleAny: ["ванпанчмен", "ван-панчмен", "onepunch", "one-punch"], titleNone: MANGA_NONE, genres: ["Сёнэн", "Экшен"] },
    { q: "intitle:Вагабонд manga Иноуэ", titleAny: ["вагабонд", "vagabond"], titleNone: MANGA_NONE, genres: ["Сэйнэн", "Приключения"] },
    { q: "intitle:Корзинка фруктов manga", titleAny: ["корзинка фруктов", "fruits basket"], titleNone: MANGA_NONE, genres: ["Сёдзё", "Фэнтези"] },
    { q: "intitle:Монстр manga Урасава", titleAny: ["монстр", "monster"], titleNone: MANGA_NONE, genres: ["Сэйнэн", "Триллер", "Детектив"] },
  ],
};
