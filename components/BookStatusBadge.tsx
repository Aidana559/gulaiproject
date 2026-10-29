"use client";

import type { Book } from "@/data/books";
import { useBookState } from "@/lib/txStore";
import StatusBadge from "./StatusBadge";

/** Бейдж статуса, который реагирует на брони и транзакции */
export default function BookStatusBadge({ book }: { book: Book }) {
  const { status } = useBookState(book);
  return <StatusBadge status={status} />;
}