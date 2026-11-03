"use client";

import { useEffect, useState, useCallback } from "react";
import { books as staticBooks, type Book, type Category, type Status } from "@/data/books";

const STORAGE_KEY = "p2p-user-books";
const DELETED_KEY = "p2p-deleted-books";
const EDITS_KEY = "p2p-book-edits";

const GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-teal-500 to-emerald-600",
  "from-rose-500 to-orange-500",
  "from-sky-500 to-blue-700",
  "from-amber-400 to-orange-600",
  "from-fuchsia-500 to-pink-600",
  "from-cyan-500 to-teal-700",
  "from-violet-500 to-indigo-700",
];

export type NewBookInput = {
  title: string;
  author: string;
  category: Category;
  genre: string;
  year?: number;
  city: string;
  description?: string;
  owner?: string;
  pages?: number;
};

function readUserBooks(): Book[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Book[];
  } catch {
    return [];
  }
}

function readDeleted(): number[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DELETED_KEY) ?? "[]") as number[];
  } catch {
    return [];
  }
}

function readEdits(): Record<string, Partial<Book>> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(EDITS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeUserBooks(list: Book[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("p2p-books-changed"));
}

export function getAllBooks(): Book[] {
  const deleted = new Set(readDeleted());
  const edits = readEdits();
  const user = readUserBooks();

  const base = staticBooks
    .filter((b) => !deleted.has(b.id))
    .map((b) => {
      const patch = edits[String(b.id)];
      return patch ? { ...b, ...patch } : b;
    });

  const userFiltered = user
    .filter((b) => !deleted.has(b.id))
    .map((b) => {
      const patch = edits[String(b.id)];
      return patch ? { ...b, ...patch } : b;
    });

  return [...userFiltered, ...base];
}

export function getBookById(id: number): Book | undefined {
  return getAllBooks().find((b) => b.id === id);
}

export function addBook(input: NewBookInput): Book {
  const list = readUserBooks();
  const maxStatic = staticBooks.reduce((m, b) => Math.max(m, b.id), 0);
  const maxUser = list.reduce((m, b) => Math.max(m, b.id), 0);
  const id = Math.max(maxStatic, maxUser, 1000) + 1;

  const book: Book = {
    id,
    title: input.title.trim(),
    author: input.author.trim(),
    category: input.category,
    genre: input.genre.trim() || "—",
    year: input.year || new Date().getFullYear(),
    city: input.city.trim() || "—",
    description: input.description?.trim() || "",
    owner: input.owner?.trim() || "Вы",
    pages: input.pages || 0,
    status: "available" as Status,
    gradient: GRADIENTS[id % GRADIENTS.length],
  };

  list.unshift(book);
  writeUserBooks(list);
  return book;
}

export function removeBook(id: number) {
  const deleted = readDeleted();
  if (!deleted.includes(id)) {
    deleted.push(id);
    localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
  }
  writeUserBooks(readUserBooks().filter((b) => b.id !== id));
  window.dispatchEvent(new Event("p2p-books-changed"));
}

export function updateBook(id: number, patch: Partial<Book>) {
  const edits = readEdits();
  edits[String(id)] = { ...edits[String(id)], ...patch };
  localStorage.setItem(EDITS_KEY, JSON.stringify(edits));

  const list = readUserBooks();
  const idx = list.findIndex((b) => b.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    writeUserBooks(list);
  } else {
    window.dispatchEvent(new Event("p2p-books-changed"));
  }
}

export function useBooks(): Book[] {
  const [list, setList] = useState<Book[]>(() =>
    typeof window === "undefined" ? staticBooks : getAllBooks(),
  );

  const refresh = useCallback(() => setList(getAllBooks()), []);

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === DELETED_KEY || e.key === EDITS_KEY) refresh();
    };
    window.addEventListener("p2p-books-changed", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("p2p-books-changed", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  return list;
}
