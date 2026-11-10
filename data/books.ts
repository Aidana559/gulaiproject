export type Category = "book" | "textbook" | "guide" | "manga";
export type Status = "available" | "reserved" | "given";

export interface Book {
  id: number;
  title: string;
  author: string;
  category: Category;
  genre: string; // основной жанр (первый из genres)
  genres?: string[]; // все жанры книги — книга может относиться к нескольким
  status: Status;
  owner: string;
  city: string;
  year: number;
  pages: number;
  description: string;
  isbn?: string;
  googleId?: string;
  coverUrl?: string | null;
  gradient: string; // tailwind gradient classes for the cover
}

export const categoryLabels: Record<Category, string> = {
  book: "Книги",
  textbook: "Учебники",
  guide: "Методички",
  manga: "Манга",
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

/**
 * Каталог больше не хранится в коде: книги загружаются из Google Books API
 * (lib/catalog-loader.ts) и лежат в data/catalog-books.json.
 * Пустой массив оставлен для совместимости со старыми импортами.
 */
export const books: Book[] = [];

/**
 * Список жанров для форм (добавление/правка книги, админка).
 * Фильтр жанров в каталоге строится из реальных книг (см. /api/books).
 */
export const genres: string[] = [
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
  "Химия",
  "Хоррор",
  "Экономика",
  "Экшен",
  "Языки",
].sort((a, b) => a.localeCompare(b, "ru"));
