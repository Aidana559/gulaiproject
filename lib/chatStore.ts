"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  ChatAccessError,
  canUseChat,
  checkChatAccess,
  participantRole,
  type ChatActor,
  type ChatCheck,
  type ChatParties,
} from "@/lib/chatAccess";

export { ChatAccessError } from "@/lib/chatAccess";

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
  /** id участника → сколько сообщений он удалил у себя вместе с чатом («удалить у меня») */
  cleared?: Record<string, number>;
};
export type Me = { id: string; name: string };

/** Один диалог = одна книга + один читатель + один владелец (дубликатов не создаётся). */
export const conversationId = (bookId: string, buyerId: string, owner: Party) =>
  `${bookId}|${buyerId}|${owner.id ?? `name:${owner.name}`}`;

/** Кем является пользователь в диалоге (null — не участник). Только по id. */
export function roleIn(c: Conversation, me: Me): ChatRole | null {
  return participantRole(c, me.id);
}

export const unreadIn = (c: Conversation, role: ChatRole) =>
  c.messages.slice(c.seen[role] ?? 0).filter((m) => m.from !== role).length;

// ---------- сессия чата ----------
/**
 * Кто сейчас пользуется чатами, определяется ТОЛЬКО по серверной сессии
 * (/api/auth/me, подписанная cookie) и справочнику /api/chat/directory.
 * Ни одна операция ниже не принимает id или роль пользователя в аргументах.
 */
export type ChatSession = {
  status: "loading" | "anon" | "denied" | "ok";
  me: Me | null;
  /** пользователи с ролью `user` (id → имя); null — справочник не загружен */
  peers: ReadonlyMap<string, string> | null;
};

const LOADING: ChatSession = { status: "loading", me: null, peers: null };
const ANON: ChatSession = { status: "anon", me: null, peers: null };
let session: ChatSession = LOADING;
let actor: ChatActor | null = null;
let sessionSeq = 0;

function setSession(next: ChatSession, nextActor: ChatActor | null) {
  session = next;
  actor = nextActor;
  listeners.forEach((l) => l());
}

/** Перечитывает сессию с сервера. Вызывается из AuthProvider при входе, выходе и фокусе окна. */
export async function refreshChatSession(): Promise<void> {
  const seq = ++sessionSeq;
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = res.ok ? await res.json() : null;
    const u = data?.user;
    if (seq !== sessionSeq) return;
    if (!u || u.id == null) return setSession(ANON, null);

    const a: ChatActor = { id: String(u.id), name: String(u.name), role: String(u.role) };
    if (!canUseChat(a.role)) return setSession({ status: "denied", me: null, peers: null }, a);

    let peers: Map<string, string> | null = null;
    try {
      const r = await fetch("/api/chat/directory", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        peers = new Map((j.users as { id: string; name: string }[]).map((p) => [String(p.id), p.name]));
      }
    } catch {
      /* справочника нет — писать нельзя (fail closed), читать свои чаты можно */
    }
    if (seq !== sessionSeq) return;
    setSession({ status: "ok", me: { id: a.id, name: a.name }, peers }, a);
  } catch {
    if (seq === sessionSeq) setSession(ANON, null);
  }
}

/** Сброс при выходе: чаты сразу перестают быть доступными. */
export function clearChatSession() {
  sessionSeq++;
  setSession(ANON, null);
}

export function useChatSession(): ChatSession {
  return useSyncExternalStore(subscribe, () => session, () => LOADING);
}

/** Проверка прав для всех операций: бросает ChatAccessError, если доступ запрещён. */
function guard(check: Omit<ChatCheck, "eligibleIds"> = {}): ChatActor {
  const peers = session.peers ? new Set(session.peers.keys()) : null;
  const d = checkChatAccess(actor, { ...check, eligibleIds: peers });
  if (!d.ok) throw new ChatAccessError(d.reason);
  return actor!;
}

// ---------- хранилище (внутреннее) ----------
const EMPTY: Conversation[] = [];
let raw: string | null | undefined;
let cache: Conversation[] = EMPTY;
const listeners = new Set<() => void>();

/** Все диалоги браузера. НЕ экспортируется: наружу данные отдаются только через guarded-функции. */
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

const lastAt = (c: Conversation) => c.messages[c.messages.length - 1]?.at ?? c.createdAt;

/** Диалог глазами участника: без сообщений, которые он удалил у себя. null — для него чата нет. */
function viewFor(c: Conversation, meId: string): Conversation | null {
  const n = c.cleared?.[meId];
  if (n === undefined) return c;
  const messages = c.messages.slice(n);
  if (messages.length === 0) return null; // удалён, новых сообщений нет
  return { ...c, messages, seen: { buyer: Math.max(0, c.seen.buyer - n), owner: Math.max(0, c.seen.owner - n) } };
}

/** Только диалоги, где текущий пользователь — участник; без доступа — пусто. */
function visibleChats(all: Conversation[], s: ChatSession): Conversation[] {
  const me = s.me;
  if (s.status !== "ok" || !me) return EMPTY;
  return all
    .filter((c) => participantRole(c, me.id))
    .map((c) => viewFor(c, me.id))
    .filter((c): c is Conversation => c !== null)
    .sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
}

// ---------- хуки для интерфейса (без доступа возвращают пустое значение) ----------
function useAllRaw(): Conversation[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** Диалоги текущего пользователя, новые сверху. admin / moderator всегда получают []. */
export function useMyChats(): Conversation[] {
  const all = useAllRaw();
  const s = useChatSession();
  return useMemo(() => visibleChats(all, s), [all, s]);
}

export function useUnreadTotal(): number {
  const mine = useMyChats();
  const s = useChatSession();
  return useMemo(
    () => (s.me ? mine.reduce((sum, c) => sum + unreadIn(c, participantRole(c, s.me!.id)!), 0) : 0),
    [mine, s],
  );
}

// ---------- операции (каждая проверяет права при каждом вызове) ----------

/** Список чатов текущего пользователя. */
export function listChats(): Conversation[] {
  guard();
  return visibleChats(snapshot(), session);
}

/** Один чат; чужой или несуществующий — запрещён. */
export function getChat(id: string): Conversation {
  const c = snapshot().find((x) => x.id === id);
  if (!c) throw new ChatAccessError("not-participant"); // не раскрываем, существует ли чат
  guard({ conversation: c });
  const v = viewFor(c, session.me!.id);
  if (!v) throw new ChatAccessError("not-participant");
  return v;
}

/** Количество непрочитанных сообщений. */
export function getUnreadCount(): number {
  const me = guard() && session.me!;
  return listChats().reduce((sum, c) => sum + unreadIn(c, participantRole(c, me.id)!), 0);
}

/**
 * Черновик диалога с владельцем книги (в хранилище попадает при первом сообщении).
 * Читатель всегда текущий пользователь, имя владельца берётся из серверного справочника.
 */
export function newConversation(
  book: { id: string; title: string; author: string },
  ownerId: string | undefined,
): Conversation {
  const me = guard() && session.me!;
  const ownerName = ownerId ? session.peers?.get(ownerId) : undefined;
  const owner: Party = { id: ownerId, name: ownerName ?? "" };
  const conv: Conversation = {
    id: conversationId(book.id, me.id, owner),
    bookId: book.id,
    bookTitle: book.title,
    bookAuthor: book.author,
    buyer: { id: me.id, name: me.name },
    owner,
    messages: [],
    seen: { buyer: 0, owner: 0 },
    createdAt: new Date().toISOString(),
  };
  guard({ conversation: conv, write: true }); // оба участника — user, не self
  return conv;
}

/** Добавляет сообщение; диалог создаётся при первом сообщении. Автор — всегда текущий пользователь. */
export function sendMessage(base: Conversation, text: string) {
  guard();
  const clean = text.trim().slice(0, MESSAGE_MAX);
  const all = snapshot();
  const found = all.find((c) => c.id === base.id);

  let conv: Conversation;
  if (found) {
    guard({ conversation: found, write: true });
    conv = { ...found, messages: [...found.messages] };
  } else {
    // новый диалог: не доверяем переданному объекту, пересобираем его из проверенных данных
    const fresh = newConversation(
      { id: base.bookId, title: base.bookTitle, author: base.bookAuthor },
      base.owner.id,
    );
    if (fresh.id !== base.id) throw new ChatAccessError("not-participant");
    conv = fresh;
  }
  if (!clean) return;

  const role = participantRole(conv, session.me!.id)!;
  conv.messages.push({ id: crypto.randomUUID(), from: role, text: clean, at: new Date().toISOString() });
  conv.seen = { ...conv.seen, [role]: conv.messages.length };
  write(found ? all.map((c) => (c.id === conv.id ? conv : c)) : [...all, conv]);
}

/** Отметить сообщения диалога прочитанными (только за себя). */
export function markSeen(id: string) {
  const all = snapshot();
  const c = all.find((x) => x.id === id);
  if (!c) return;
  guard({ conversation: c });
  const role = participantRole(c, session.me!.id)!;
  if ((c.seen[role] ?? 0) >= c.messages.length) return;
  write(all.map((x) => (x.id === id ? { ...x, seen: { ...x.seen, [role]: x.messages.length } } : x)));
}

/**
 * Удалить выбранные чаты у себя (одной операцией). Собеседник сохраняет переписку;
 * когда удалили оба — запись стирается. Новое сообщение от собеседника вернёт чат
 * без удалённой истории. Если хотя бы один чат недоступен — не меняется ничего.
 */
export function deleteConversations(ids: string[]) {
  const all = snapshot();
  const meId = (guard(), session.me!.id);
  const targets = new Map<string, Conversation>();
  for (const id of new Set(ids)) {
    const c = all.find((x) => x.id === id);
    if (!c) throw new ChatAccessError("not-participant"); // не раскрываем, существует ли чат
    guard({ conversation: c }); // только участник с ролью user
    targets.set(id, c);
  }
  if (targets.size === 0) return;

  const drop = new Set<string>();
  const next = all.map((c) => {
    if (!targets.has(c.id)) return c;
    const role = participantRole(c, meId)!;
    const n = c.messages.length;
    const upd: Conversation = { ...c, cleared: { ...c.cleared, [meId]: n }, seen: { ...c.seen, [role]: n } };
    const otherId = role === "buyer" ? c.owner.id : c.buyer.id;
    if (otherId && (upd.cleared![otherId] ?? -1) >= n) drop.add(c.id);
    return upd;
  });
  write(next.filter((c) => !drop.has(c.id)));
}

// Редактирования сообщений / переписок в приложении нет. Если появятся,
// они обязаны начинаться с guard({ conversation }) и не должны экспортировать write().
export type { ChatParties };
