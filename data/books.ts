export type Category = "book" | "textbook" | "guide" | "manga";
export type Status = "available" | "reserved" | "given";

export interface Book {
  id: number;
  title: string;
  author: string;
  category: Category;
  genre: string;
  status: Status;
  owner: string;
  city: string;
  year: number;
  pages: number;
  description: string;
  gradient: string; // tailwind gradient classes for the cover
}

export const categoryLabels: Record<Category, string> = {
  book: "Книги",
  textbook: "Учебники",
  guide: "Методички",
  manga: "Манга",
};

export const categoryEmoji: Record<Category, string> = {
  book: "📖",
  textbook: "🎓",
  guide: "📝",
  manga: "🈸",
};

export const statusLabels: Record<Status, string> = {
  available: "Доступна",
  reserved: "Забронирована",
  given: "Отдана",
};

export const statusStyles: Record<Status, string> = {
  available: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
  reserved: "bg-amber-100 text-amber-700 ring-amber-600/20",
  given: "bg-stone-200 text-stone-600 ring-stone-500/20",
};

const g = {
  indigo: "from-indigo-500 to-purple-600",
  rose: "from-rose-500 to-orange-500",
  emerald: "from-emerald-500 to-teal-600",
  sky: "from-sky-500 to-blue-700",
  amber: "from-amber-400 to-red-500",
  fuchsia: "from-fuchsia-500 to-pink-600",
  slate: "from-slate-600 to-slate-800",
  lime: "from-lime-500 to-green-600",
};

type Seed = Omit<Book, "id" | "owner" | "city" | "gradient"> & { g: keyof typeof g };

const owners = ["Айдана К.", "Дамир Т.", "Мария С.", "Арман Б.", "Алина Н.", "Тимур Ж.", "Сабина М.", "Иван П."];
const cities = ["Алматы", "Астана", "Кызылорда", "Шымкент", "Караганда"];

const seeds: Seed[] = [
  // Книги
  { title: "Мастер и Маргарита", author: "М. А. Булгаков", category: "book", genre: "Классика", status: "available", year: 1967, pages: 480, g: "rose", description: "Роман о визите дьявола в Москву 1930-х, о любви, трусости и прощении." },
  { title: "Преступление и наказание", author: "Ф. М. Достоевский", category: "book", genre: "Классика", status: "available", year: 1866, pages: 576, g: "slate", description: "История студента Раскольникова и его теории о «право имеющих»." },
  { title: "1984", author: "Джордж Оруэлл", category: "book", genre: "Антиутопия", status: "reserved", year: 1949, pages: 328, g: "slate", description: "Культовая антиутопия о тоталитарном обществе и контроле над мыслью." },
  { title: "Маленький принц", author: "Антуан де Сент-Экзюпери", category: "book", genre: "Сказка", status: "available", year: 1943, pages: 96, g: "sky", description: "Философская сказка о дружбе, ответственности и взрослении." },
  { title: "Гарри Поттер и философский камень", author: "Дж. К. Роулинг", category: "book", genre: "Фэнтези", status: "available", year: 1997, pages: 432, g: "amber", description: "Первая книга о мальчике-волшебнике и школе Хогвартс." },
  { title: "Властелин колец: Братство Кольца", author: "Дж. Р. Р. Толкин", category: "book", genre: "Фэнтези", status: "given", year: 1954, pages: 512, g: "emerald", description: "Начало эпического путешествия к Роковой горе." },
  { title: "Путь Абая", author: "Мухтар Ауэзов", category: "book", genre: "Классика", status: "available", year: 1942, pages: 720, g: "lime", description: "Роман-эпопея о жизни великого казахского поэта и мыслителя." },
  { title: "Атомные привычки", author: "Джеймс Клир", category: "book", genre: "Саморазвитие", status: "available", year: 2018, pages: 320, g: "indigo", description: "Как маленькие изменения приводят к большим результатам." },
  { title: "Sapiens. Краткая история человечества", author: "Юваль Ной Харари", category: "book", genre: "Наука", status: "reserved", year: 2011, pages: 512, g: "amber", description: "Взгляд на историю Homo sapiens от древности до наших дней." },
  { title: "Три товарища", author: "Эрих Мария Ремарк", category: "book", genre: "Классика", status: "available", year: 1936, pages: 448, g: "sky", description: "Дружба и любовь в Германии между двумя войнами." },
  { title: "Дюна", author: "Фрэнк Герберт", category: "book", genre: "Фантастика", status: "available", year: 1965, pages: 704, g: "amber", description: "Борьба за пустынную планету Арракис и её драгоценную пряность." },
  { title: "Сто лет одиночества", author: "Габриэль Гарсиа Маркес", category: "book", genre: "Классика", status: "available", year: 1967, pages: 416, g: "fuchsia", description: "Сага о семье Буэндиа и городе Макондо." },

  // Учебники
  { title: "Алгоритмы: построение и анализ", author: "Т. Кормен и др.", category: "textbook", genre: "Информатика", status: "available", year: 2013, pages: 1328, g: "indigo", description: "Фундаментальный учебник по алгоритмам и структурам данных." },
  { title: "Основы программирования на Python", author: "Марк Лутц", category: "textbook", genre: "Информатика", status: "available", year: 2020, pages: 1280, g: "emerald", description: "Подробное руководство по языку Python для студентов." },
  { title: "Высшая математика. Том 1", author: "Н. С. Пискунов", category: "textbook", genre: "Математика", status: "reserved", year: 2018, pages: 456, g: "sky", description: "Дифференциальное и интегральное исчисление для вузов." },
  { title: "Линейная алгебра и аналитическая геометрия", author: "Д. В. Беклемишев", category: "textbook", genre: "Математика", status: "available", year: 2016, pages: 376, g: "slate", description: "Классический курс для технических и математических факультетов." },
  { title: "Общая физика", author: "И. В. Савельев", category: "textbook", genre: "Физика", status: "available", year: 2011, pages: 432, g: "indigo", description: "Механика, молекулярная физика, электричество и оптика." },
  { title: "Органическая химия", author: "Дж. Кларк", category: "textbook", genre: "Химия", status: "available", year: 2015, pages: 608, g: "lime", description: "Понятное введение в органическую химию." },
  { title: "Экономикс", author: "К. Макконнелл, С. Брю", category: "textbook", genre: "Экономика", status: "given", year: 2018, pages: 1024, g: "amber", description: "Принципы, проблемы и политика — основа экономической теории." },
  { title: "Базы данных. Полный курс", author: "Г. Гарсиа-Молина", category: "textbook", genre: "Информатика", status: "available", year: 2017, pages: 1088, g: "sky", description: "Проектирование и реализация систем баз данных, SQL." },
  { title: "Английский язык: Grammar in Use", author: "Рэймонд Мёрфи", category: "textbook", genre: "Языки", status: "available", year: 2019, pages: 380, g: "rose", description: "Самый популярный учебник английской грамматики." },
  { title: "История Казахстана", author: "Коллектив авторов", category: "textbook", genre: "История", status: "available", year: 2020, pages: 352, g: "emerald", description: "Учебник по истории Казахстана с древности до современности." },

  // Методички
  { title: "Методичка по лабораторным работам: Физика", author: "Кафедра физики", category: "guide", genre: "Физика", status: "available", year: 2022, pages: 84, g: "indigo", description: "Описание лабораторных работ по механике и электричеству." },
  { title: "Практикум по программированию на C++", author: "Кафедра ИТ", category: "guide", genre: "Информатика", status: "available", year: 2023, pages: 120, g: "slate", description: "Задания и примеры для практических занятий." },
  { title: "Методические указания по курсовой работе", author: "Учебно-методический отдел", category: "guide", genre: "Оформление", status: "reserved", year: 2021, pages: 48, g: "amber", description: "Требования к структуре и оформлению курсовых работ." },
  { title: "Сборник задач по математическому анализу", author: "Б. П. Демидович", category: "guide", genre: "Математика", status: "available", year: 2019, pages: 560, g: "sky", description: "Классический задачник для подготовки к экзаменам." },
  { title: "Методичка по общей химии", author: "Кафедра химии", category: "guide", genre: "Химия", status: "available", year: 2022, pages: 96, g: "lime", description: "Лабораторный практикум и контрольные вопросы." },
  { title: "Руководство по написанию дипломной работы", author: "Деканат", category: "guide", genre: "Оформление", status: "available", year: 2023, pages: 64, g: "fuchsia", description: "Этапы подготовки, оформление и защита диплома." },
  { title: "Практикум по базам данных (SQL)", author: "Кафедра ИТ", category: "guide", genre: "Информатика", status: "given", year: 2022, pages: 72, g: "emerald", description: "Задания по SQL с разбором решений." },
  { title: "Методичка по сопромату", author: "Кафедра механики", category: "guide", genre: "Инженерия", status: "available", year: 2020, pages: 110, g: "rose", description: "Расчётно-графические работы и примеры решений." },

  // Манга
  { title: "Наруто. Том 1", author: "Масаси Кисимото", category: "manga", genre: "Сёнэн", status: "available", year: 1999, pages: 192, g: "amber", description: "Юный ниндзя мечтает стать Хокаге — главой деревни." },
  { title: "Ван-Пис. Том 1", author: "Эйитиро Ода", category: "manga", genre: "Приключения", status: "available", year: 1997, pages: 208, g: "sky", description: "Монки Д. Луффи отправляется на поиски сокровища One Piece." },
  { title: "Атака титанов. Том 1", author: "Хадзимэ Исаяма", category: "manga", genre: "Экшен", status: "reserved", year: 2009, pages: 192, g: "slate", description: "Человечество прячется за стенами от гигантских титанов." },
  { title: "Тетрадь смерти. Том 1", author: "Цугуми Ооба, Такэси Обата", category: "manga", genre: "Триллер", status: "available", year: 2003, pages: 200, g: "slate", description: "Школьник находит тетрадь, убивающую любого, чьё имя в ней написано." },
  { title: "Фрирен, провожающая в последний путь. Том 1", author: "Кэнъити Абэ", category: "manga", genre: "Фэнтези", status: "available", year: 2020, pages: 192, g: "emerald", description: "Эльфийка-маг переосмысляет жизнь после смерти героя." },
  { title: "Истребитель демонов. Том 1", author: "Койохару Готогэ", category: "manga", genre: "Сёнэн", status: "available", year: 2016, pages: 192, g: "rose", description: "Тандзиро становится охотником на демонов, чтобы спасти сестру." },
  { title: "Магическая битва. Том 1", author: "Гэгэ Акутами", category: "manga", genre: "Экшен", status: "given", year: 2018, pages: 192, g: "indigo", description: "Старшеклассник вступает в школу заклинателей проклятий." },
  { title: "Блич. Том 1", author: "Тайто Кубо", category: "manga", genre: "Сёнэн", status: "available", year: 2001, pages: 192, g: "fuchsia", description: "Ичиго Куросаки получает силы сопровождающего душ — синигами." },
  { title: "Fullmetal Alchemist. Том 1", author: "Хирому Аракава", category: "manga", genre: "Приключения", status: "available", year: 2001, pages: 192, g: "amber", description: "Братья Элрики ищут способ вернуть утраченные тела." },
  { title: "Токийский гуль. Том 1", author: "Суи Исида", category: "manga", genre: "Хоррор", status: "available", year: 2011, pages: 224, g: "slate", description: "Студент Канэки становится наполовину гулем." },
  { title: "Берсерк. Том 1", author: "Кэнтаро Миура", category: "manga", genre: "Тёмное фэнтези", status: "reserved", year: 1989, pages: 224, g: "slate", description: "Мрачная сага о наёмнике Гатсе и его огромном мече." },
  { title: "Моя геройская академия. Том 1", author: "Кохэй Хорикоси", category: "manga", genre: "Сёнэн", status: "available", year: 2014, pages: 192, g: "lime", description: "Мальчик без причуды мечтает стать величайшим героем." },
];

export const books: Book[] = seeds.map(({ g: grad, ...rest }, i) => ({
  ...rest,
  id: i + 1,
  owner: owners[i % owners.length],
  city: cities[i % cities.length],
  gradient: g[grad],
}));

export const genres: string[] = Array.from(new Set(books.map((b) => b.genre))).sort((a, b) =>
  a.localeCompare(b, "ru"),
);

export function getBook(id: number): Book | undefined {
  return books.find((b) => b.id === id);
}