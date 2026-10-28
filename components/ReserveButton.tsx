"use client";

import Link from "next/link";
import type { Book } from "@/data/books";
import { cancelMyReservation, reserveBook, useBookState } from "@/lib/txStore";
import { Button } from "./Button";

export default function ReserveButton({ book }: { book: Book }) {
  const { status, mine } = useBookState(book);

  if (status === "given") {
    return <Button disabled size="lg">Книга уже отдана</Button>;
  }

  if (status === "reserved") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled size="lg" variant="secondary">
          {mine ? "Вы забронировали" : "Забронирована"}
        </Button>
        {mine && (
          <Button variant="outline" size="lg" onClick={() => cancelMyReservation(book.id)}>
            Снять бронь
          </Button>
        )}
        <Link href="/transactions" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          Смотреть в транзакциях →
        </Link>
      </div>
    );
  }

  return (
    <Button size="lg" onClick={() => reserveBook(book.id)}>
      📌 Забронировать
    </Button>
  );
}