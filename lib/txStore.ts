"use client";

import { useMemo, useSyncExternalStore } from "react";
import raw from "@/data/transactions.json";
import type { Book, Status } from "@/data/books";
import { addDays, type Transaction, type TransactionWithBook } from "@/data/transactions";

/**
 * Общее хранилище транзакций на клиенте (пока нет бэкенда).
 * Данные сохраняются в localStorage, поэтому видны и на странице книги, и в «Транзакциях».
 */
const KEY = "page2page:transactions:v2";
export const ME = "Вы";

const initial = raw as Transaction[];
let state: Transaction[] = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const s = localStorage.getItem(KEY);
    if (s) state = JSON.parse(s) as Transaction[];
  } catch {
    /* localStorage недоступен — работаем в памяти */
  }
}

function set(next: Transaction[]) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** Книги каталога (загружаются с сервера): транзакции показывают именно их */
let catalog = new Map<number, Book>();
let catalogVersion = 0;
let catalogRequested = false;

function loadCatalog() {
  if (catalogRequested || typeof window === "undefined") return;
  catalogRequested = true;
  fetch("/api/books?limit=100", { cache: "no-store" })
    .then((r) => r.json())
    .then((j: { books?: Book[] }) => {
      catalog = new Map((j.books ?? []).map((b) => [Number(b.id), b]));
      catalogVersion++;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      catalogRequested = false;
    });
}

const getBook = (id: number) => catalog.get(Number(id));

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => {
  load();
  return state;
};
const getServerSnapshot = () => initial;

function useRaw(): Transaction[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Книги каталога по id (для обложек и ссылок в списках броней) */
export function useCatalogBooks(): Map<number, Book> {
  useSyncExternalStore(
    subscribe,
    () => {
      loadCatalog();
      return catalogVersion;
    },
    () => 0,
  );
  return catalog;
}

/** Все транзакции вместе с данными книги */
export function useTransactions(): TransactionWithBook[] {
  const list = useRaw();
  const version = useSyncExternalStore(
    subscribe,
    () => {
      loadCatalog();
      return catalogVersion;
    },
    () => 0,
  );
  return useMemo(
    () => list.flatMap((t) => {
      const book = getBook(t.bookId);
      return book ? [{ ...t, book }] : [];
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, version],
  );
}

export function updateTransaction(id: number, patch: Partial<Transaction>) {
  set(state.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function removeTransaction(id: number) {
  set(state.filter((t) => t.id !== id));
}

/** Забронировать книгу от имени текущего пользователя (срок — 14 дней) */
export function reserveBook(bookId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const id = state.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  set([...state, { id, bookId, person: ME, status: "reserved", startDate: today, dueDate: addDays(today, 14) }]);
}

/** Снять бронь пользователя с книги */
export function cancelMyReservation(bookId: number) {
  set(state.filter((t) => !(t.bookId === bookId && t.person === ME && t.status === "reserved")));
}

/** Актуальный статус книги и признак «забронировал я» (чистая функция) */
export function bookState(book: Book, list: Transaction[]): { status: Status; mine: boolean } {
  const mine = list.some((t) => t.bookId === book.id && t.person === ME && t.status === "reserved");
  if (mine) return { status: "reserved", mine: true };
  // бронь/выдача других людей по транзакциям
  const active = list.find((t) => t.bookId === book.id && t.status !== "returned");
  if (active) return { status: active.status === "reserved" ? "reserved" : "given", mine: false };
  // нет активных транзакций: если книга числилась занятой в каталоге, но транзакцию отменили — снова доступна
  return { status: book.status === "available" || book.status === "reserved" ? "available" : book.status, mine: false };
}

export function useBookState(book: Book): { status: Status; mine: boolean } {
  return bookState(book, useRaw());
}