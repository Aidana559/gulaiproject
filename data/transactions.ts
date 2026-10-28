import raw from "./transactions.json";
import { getBook, type Book } from "./books";

export type TxStatus = "reserved" | "borrowed" | "overdue" | "returned";

export interface Transaction {
  id: number;
  bookId: number;
  person: string; // кто взял / забронировал
  status: TxStatus;
  startDate: string; // YYYY-MM-DD — дата выдачи или брони
  dueDate: string; // YYYY-MM-DD — когда вернуть
}

export interface TransactionWithBook extends Transaction {
  book: Book;
}

export const txLabels: Record<TxStatus, string> = {
  reserved: "Бронь",
  borrowed: "На руках",
  overdue: "Просрочена",
  returned: "Возвращена",
};

export const txStyles: Record<TxStatus, string> = {
  reserved: "bg-amber-100 text-amber-700 ring-amber-600/20",
  borrowed: "bg-sky-100 text-sky-700 ring-sky-600/20",
  overdue: "bg-rose-100 text-rose-700 ring-rose-600/20",
  returned: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
};

export const transactions: TransactionWithBook[] = (raw as Transaction[]).flatMap((t) => {
  const book = getBook(t.bookId);
  return book ? [{ ...t, book }] : [];
});

const months = ["янв.", "февр.", "марта", "апр.", "мая", "июня", "июля", "авг.", "сент.", "окт.", "нояб.", "дек."];

/** "2026-11-05" -> "5 нояб. 2026" (без Date, чтобы не было расхождений сервера и клиента) */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

/** Прибавить дни к дате YYYY-MM-DD */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}