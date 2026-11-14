"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Переписка по книгам. Пока нет сервера и общей БД, история хранится в localStorage
 * этого браузера (ключ ниже) и не синхронизируется между устройствами.
 * В одном браузере хранилище общее для всех аккаунтов: каждый пользователь видит только
 * переписки, где он покупатель (читатель) или владелец книги, поэтому смена аккаунта работает.
 */
const KEY = "kitapta:chats:v1";
export const MESSAGE_MAX = 2000;

export type ChatRole = "buyer" | "owner";
export type Party = { id?: string; name: string };
export type ChatMessage = { id: string; from: ChatRole; text: string; at: string };
export type Conversation = {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  buyer: { id: string; name: string };
  owner: Party;
  messages: ChatMessage[];
  /** сколько сообщений каждая сторона уже видела */
  seen: Record<ChatRole, number>;
  createdAt: string;
};
export type Me = { id: string; name: string };

/** Один диалог = одна книга + один читатель + один владелец (дубликатов не создаётся). */
export const conversationId = (bookId: string, buyerId: string, owner: Party) =>
  `${bookId}|${buyerId}|${owner.id ?? `name:${owner.name}`}`;

export function newConversation(
  book: { id: string; title: string; author: string },
  buyer: Me,
  owner: Party,
): Conversation {
  return {
    id: conversationId(book.id, buyer.id, owner),
    bookId: book.id,
    bookTitle: book.title,
    bookAuthor: book.author,
    buyer: { id: buyer.id, name: buyer.name },
    owner,
    messages: [],
    seen: { buyer: 0, owner: 0 },
    createdAt: new Date().toISOString(),
  };
}

/** Кем является пользователь в диалоге (null — не участник). */
export function roleIn(c: Conversation, me: Me): ChatRole | null {
  if (c.buyer.id === me.id) return "buyer";
  if (c.owner.id ? c.owner.id === me.id : c.owner.name === me.name) return "owner";
  return null;
}

export const unreadIn = (c: Conversation, role: ChatRole) =>
  c.messages.slice(c.seen[role] ?? 0).filter((m) => m.from !== role).length;

// ---------- хранилище ----------
const EMPTY: Conversation[] = [];
let raw: string | null | undefined;
let cache: Conversation[] = EMPTY;
const listeners = new Set<() => void>();

function snapshot(): Conversation[] {
  let s: string | null = null;
  try {
    s = localStorage.getItem(KEY);
  } catch {
    return cache; // localStorage недоступен — работаем в памяти
  }
  if (s !== raw) {
    raw = s;
    try {
      const p = s ? JSON.parse(s) : [];
      cache = Array.isArray(p) ? (p as Conversation[]) : EMPTY;
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb(); // другая вкладка этого браузера
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: Conversation[]) {
  cache = next;
  try {
    const s = JSON.stringify(next);
    localStorage.setItem(KEY, s);
    raw = s;
  } catch {
    /* только память */
  }
  listeners.forEach((l) => l());
}

export function useChats(): Conversation[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** Диалоги пользователя, новые сверху. */
export function useMyChats(me: Me | null): Conversation[] {
  const all = useChats();
  return useMemo(() => {
    if (!me) return EMPTY;
    const last = (c: Conversation) => c.messages[c.messages.length - 1]?.at ?? c.createdAt;
    return all.filter((c) => roleIn(c, me)).sort((a, b) => last(b).localeCompare(last(a)));
  }, [all, me]);
}

export function useUnreadTotal(me: Me | null): number {
  const mine = useMyChats(me);
  return useMemo(
    () => (me ? mine.reduce((s, c) => s + unreadIn(c, roleIn(c, me)!), 0) : 0),
    [mine, me],
  );
}

/** Добавляет сообщение; диалог создаётся при первом сообщении. */
export function sendMessage(base: Conversation, role: ChatRole, text: string) {
  const clean = text.trim().slice(0, MESSAGE_MAX);
  if (!clean) return;
  const all = snapshot();
  const found = all.find((c) => c.id === base.id);
  const conv: Conversation = found
    ? { ...found, messages: [...found.messages] }
    : { ...base, messages: [], seen: { buyer: 0, owner: 0 } };
  conv.messages.push({
    id: crypto.randomUUID(),
    from: role,
    text: clean,
    at: new Date().toISOString(),
  });
  conv.seen = { ...conv.seen, [role]: conv.messages.length };
  write(found ? all.map((c) => (c.id === conv.id ? conv : c)) : [...all, conv]);
}

export function markSeen(id: string, role: ChatRole) {
  const all = snapshot();
  const c = all.find((x) => x.id === id);
  if (!c || (c.seen[role] ?? 0) >= c.messages.length) return;
  write(all.map((x) => (x.id === id ? { ...x, seen: { ...x.seen, [role]: x.messages.length } } : x)));
}
