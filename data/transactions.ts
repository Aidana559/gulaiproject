import type { Book } from "@/data/books";

/** Статусы транзакции / брони (overdue — только отображение) */
export type TxStatus =
  | "reserved"
  | "borrowed"
  | "overdue"
  | "returned"
  | "cancelled";

export interface Transaction {
  id: number;
  bookId: number;
  person: string;
  status: TxStatus;
  startDate: string;
  dueDate: string;
}

export interface TransactionWithBook extends Transaction {
  book: Book;
}

export const txLabels: Record<TxStatus, string> = {
  reserved: "Бронь",
  borrowed: "На руках",
  overdue: "Просрочена",
  returned: "Возвращена",
  cancelled: "Отменена",
};

export const txStyles: Record<TxStatus, string> = {
  reserved: "bg-amber-100 text-amber-700 ring-amber-600/20",
  borrowed: "bg-sky-100 text-sky-700 ring-sky-600/20",
  overdue: "bg-rose-100 text-rose-700 ring-rose-600/20",
  returned: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-stone-100 text-stone-600 ring-stone-500/20",
};

const months = [
  "янв.",
  "февр.",
  "марта",
  "апр.",
  "мая",
  "июня",
  "июля",
  "авг.",
  "сент.",
  "окт.",
  "нояб.",
  "дек.",
];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${months[m - 1]} ${y}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
