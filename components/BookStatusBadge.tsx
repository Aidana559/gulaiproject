"use client";

import { useEffect, useState } from "react";
import type { Book, Status } from "@/data/books";
import { statusLabels, statusStyles } from "@/data/books";
import { useTransactions } from "@/lib/txStore";

type ServerMap = Record<string, "reserved" | "given">;

let serverCache: ServerMap | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<(m: ServerMap) => void>();

async function load(): Promise<ServerMap> {
  try {
    const res = await fetch("/api/bookings?states=1", { cache: "no-store" });
    const json = await res.json();
    return (json.states ?? {}) as ServerMap;
  } catch {
    return {};
  }
}

// force = true: перезапросить даже если запрос уже идёт (после новой брони)
export function refreshBookStates(force = false) {
  if (inflight && !force) return inflight;
  const run = () =>
    load().then((m) => {
      serverCache = m;
      listeners.forEach((l) => l(m));
    });
  const p: Promise<void> = (inflight ? inflight.then(run) : run()).finally(() => {
    if (inflight === p) inflight = null;
  });
  inflight = p;
  return p;
}

const rank: Record<Status, number> = { available: 0, reserved: 1, given: 2 };

// Чистая функция: считает статус по серверной карте и демо-транзакциям
export function computeStatus(
  bookId: number,
  server: ServerMap,
  tx: ReturnType<typeof useTransactions>,
): Status {
  let status: Status = server[String(bookId)] ?? "available";
  for (const t of tx) {
    if (Number(t.book.id) !== bookId || t.status === "returned") continue;
    const s: Status = t.status === "reserved" ? "reserved" : "given";
    if (rank[s] > rank[status]) status = s;
  }
  return status;
}

// Хук, который отдаёт всю серверную карту (null, пока грузится)
export function useServerStates(): ServerMap | null {
  const [server, setServer] = useState<ServerMap | null>(serverCache);

  useEffect(() => {
    listeners.add(setServer);
    refreshBookStates();
    return () => {
      listeners.delete(setServer);
    };
  }, []);

  return server;
}

// Единый статус книги: брони с сервера + демо-транзакции из «Транзакций».
// null, пока данные загружаются.
export function useBookStatus(bookId: number): Status | null {
  const server = useServerStates();
  const tx = useTransactions();
  if (!server) return null;
  return computeStatus(bookId, server, tx);
}

export default function BookStatusBadge({ book }: { book: Book }) {
  const status = useBookStatus(book.id);

  if (!status) {
    return <span className="inline-block h-5 w-20 animate-pulse rounded-full bg-stone-100" />;
  }

  return (
    <span
      className={`inline-flex h-fit w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}