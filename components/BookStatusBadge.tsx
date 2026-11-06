"use client";

import { useEffect, useState } from "react";
import type { Book, Status } from "@/data/books";
import { statusLabels, statusStyles } from "@/data/books";

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

export function computeStatus(bookId: number, server: ServerMap): Status {
  const s = server[String(bookId)];
  if (s === "given") return "given";
  if (s === "reserved") return "reserved";
  return "available";
}

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

export function useBookStatus(bookId: number): Status | null {
  const server = useServerStates();
  if (!server) return null;
  return computeStatus(bookId, server);
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
