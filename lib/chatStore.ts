"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  ChatAccessError,
  canUseChat,
  checkChatAccess,
  isParticipant,
  type ChatActor,
  type ChatCheck,
} from "@/lib/chatAccess";
import {
  EMPTY_DB,
  STORAGE_VERSION,
  addText,
  deleteForMe,
  lastAt,
  markSeen as markSeenIn,
  migrateLegacy,
  openBook,
  openPair,
  pairId,
  parseDb,
  parseLegacy,
  unreadIn,
  viewFor,
  type ChatDb,
  type Conversation,
} from "@/lib/chatCore";

export { ChatAccessError } from "@/lib/chatAccess";
export { MESSAGE_MAX, isBookRef, otherOf, previewOf, unreadIn } from "@/lib/chatCore";
export type { BookRefMessage, ChatMessage, Conversation, Party, TextMessage } from "@/lib/chatCore";

/**
 * Переписка между пользователями. Пока нет сервера и общей БД, история хранится в localStorage
 * этого браузера (ключ ниже) и не синхронизируется между устройствами.
 * В одном браузере хранилище общее для всех аккаунтов: каждый пользователь видит только
 * чаты, где он участник, поэтому смена аккаунта работает.
 *
 * Модель: ОДНА ПАРА ПОЛЬЗОВАТЕЛЕЙ = ОДИН ЧАТ (id чата = два id участников). Книги в переписке —
 * сообщения-карточки `book_reference`. Старый ключ v1 (чат = книга + читатель + владелец) не удаляется:
 * при входе его переписки безопасно вливаются в чаты пар (lib/chatCore.ts → migrateLegacy).
 */
const KEY = `kitapta:chats:v${STORAGE_VERSION}`;
const LEGACY_KEY = "kitapta:chats:v1";

export type Me = { id: string; name: string };

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
    migrateLegacyStorage(peers); // до показа чатов: список сразу полный и без дублей
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
let raw: string | null | undefined;
let cache: ChatDb = EMPTY_DB;
const listeners = new Set<() => void>();

/** Все чаты браузера. НЕ экспортируется: наружу данные отдаются только через guarded-функции. */
function snapshot(): ChatDb {
  let s: string | null = null;
  try {
    s = localStorage.getItem(KEY);
  } catch {
    return cache; // localStorage недоступен — работаем в памяти
  }
  if (s !== raw) {
    raw = s;
    cache = parseDb(s);
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

function write(next: ChatDb) {
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

/** Вливает старые переписки (v1) в чаты пар. Безопасно и повторяемо; старый ключ не трогается. */
function migrateLegacyStorage(peers: ReadonlyMap<string, string> | null) {
  try {
    const legacy = parseLegacy(localStorage.getItem(LEGACY_KEY));
    const db = snapshot();
    if (legacy.every((l) => db.migrated.includes(l.id))) return;
    // старые чаты без id владельца: определяем по имени, только если оно однозначно
    const byName = new Map<string, string[]>();
    peers?.forEach((name, id) => byName.set(name.trim().toLowerCase(), [...(byName.get(name.trim().toLowerCase()) ?? []), id]));
    const resolve = (name: string) => {
      const ids = byName.get(name.trim().toLowerCase());
      return ids?.length === 1 ? ids[0] : undefined;
    };
    const r = migrateLegacy(db, legacy, resolve);
    if (r.merged > 0) write(r.db);
  } catch (e) {
    console.error("Не удалось объединить старые переписки (данные не изменены):", e);
  }
}

/** Диалог для показа: свои скрытые сообщения убраны, имена — из серверного справочника, если он есть. */
function visibleChats(db: ChatDb, s: ChatSession): Conversation[] {
  const me = s.me;
  if (s.status !== "ok" || !me) return [];
  return db.chats
    .filter((c) => isParticipant(c, me.id))
    .map((c) => viewFor(c, me.id))
    .filter((c): c is Conversation => c !== null)
    .map((c) => {
      const p = c.participants.map((x) => ({ id: x.id, name: s.peers?.get(x.id) ?? x.name })) as Conversation["participants"];
      return p[0].name === c.participants[0].name && p[1].name === c.participants[1].name ? c : { ...c, participants: p };
    })
    .sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
}

// ---------- хуки для интерфейса (без доступа возвращают пустое значение) ----------
const NONE: ChatDb = EMPTY_DB;
function useAllRaw(): ChatDb {
  return useSyncExternalStore(subscribe, snapshot, () => NONE);
}

/** Чаты текущего пользователя: каждый собеседник один раз, по времени последней активности. admin / moderator получают []. */
export function useMyChats(): Conversation[] {
  const all = useAllRaw();
  const s = useChatSession();
  return useMemo(() => visibleChats(all, s), [all, s]);
}

export function useUnreadTotal(): number {
  const mine = useMyChats();
  const s = useChatSession();
  return useMemo(() => (s.me ? mine.reduce((sum, c) => sum + unreadIn(c, s.me!.id), 0) : 0), [mine, s]);
}

// ---------- операции (каждая проверяет права при каждом вызове) ----------

/** Список чатов текущего пользователя. */
export function listChats(): Conversation[] {
  guard();
  return visibleChats(snapshot(), session);
}

/** Один чат; чужой или несуществующий — запрещён. */
export function getChat(id: string): Conversation {
  const c = snapshot().chats.find((x) => x.id === id);
  if (!c) throw new ChatAccessError("not-participant"); // не раскрываем, существует ли чат
  guard({ conversation: c });
  const v = viewFor(c, session.me!.id);
  if (!v) throw new ChatAccessError("not-participant");
  return v;
}

/** Количество непрочитанных сообщений. */
export function getUnreadCount(): number {
  const me = guard() && session.me!;
  return listChats().reduce((sum, c) => sum + unreadIn(c, me.id), 0);
}

/**
 * «Написать владельцу»: находит чат с владельцем книги (один на пару пользователей) или создаёт его
 * и добавляет в переписку карточку книги. Повторное обращение по той же книге карточку не дублирует.
 * Возвращает id чата. Читатель — всегда текущий пользователь, имя владельца берётся из серверного справочника.
 */
export function openChatWithBook(
  book: { id: string; title: string; author: string; coverUrl?: string | null },
  ownerId: string,
): string {
  const me = guard() && session.me!;
  const ownerName = session.peers?.get(ownerId) ?? "";
  const probe = { participants: [{ id: me.id }, { id: ownerId }] as const };
  guard({ conversation: probe, write: true }); // оба участника — user, не self
  const db = snapshot();
  const r = openBook(db, {
    me,
    owner: { id: ownerId, name: ownerName },
    book,
    now: new Date().toISOString(),
    newId: () => crypto.randomUUID(),
  });
  if (r.db !== db) write(r.db);
  return r.chatId;
}

/**
 * «Написать» из публичного профиля: находит существующий чат с этим пользователем (один на пару)
 * или готовит новый пустой; дубликатов не создаёт. Возвращает id чата.
 * Собеседник обязан быть `user` из серверного справочника, писать самому себе нельзя.
 */
export function openChatWithUser(peerId: string): string {
  const me = guard() && session.me!;
  const peerName = session.peers?.get(peerId) ?? "";
  const probe = { participants: [{ id: me.id }, { id: peerId }] as const };
  guard({ conversation: probe, write: true }); // оба участника — user, не self
  const db = snapshot();
  const r = openPair(db, { me, peer: { id: peerId, name: peerName }, now: new Date().toISOString() });
  if (r.db !== db) write(r.db);
  return r.chatId;
}

/** Добавляет текстовое сообщение. Автор — всегда текущий пользователь. */
export function sendMessage(chatId: string, text: string) {
  guard();
  const db = snapshot();
  const c = db.chats.find((x) => x.id === chatId);
  if (!c) throw new ChatAccessError("not-participant");
  guard({ conversation: c, write: true });
  const next = addText(db, { chatId, meId: session.me!.id, text, now: new Date().toISOString(), id: crypto.randomUUID() });
  if (next !== db) write(next);
}

/** Отметить сообщения чата прочитанными (только за себя). */
export function markSeen(id: string) {
  const db = snapshot();
  const c = db.chats.find((x) => x.id === id);
  if (!c) return;
  guard({ conversation: c });
  const next = markSeenIn(db, id, session.me!.id);
  if (next !== db) write(next);
}

/**
 * Удалить выбранные чаты у себя (одной операцией). Собеседник сохраняет переписку;
 * когда удалили оба — запись стирается. Новое сообщение от собеседника вернёт чат
 * без удалённой истории. Если хотя бы один чат недоступен — не меняется ничего.
 */
export function deleteConversations(ids: string[]) {
  const db = snapshot();
  guard();
  const targets = new Set<string>();
  for (const id of new Set(ids)) {
    const c = db.chats.find((x) => x.id === id);
    if (!c) throw new ChatAccessError("not-participant"); // не раскрываем, существует ли чат
    guard({ conversation: c }); // только участник с ролью user
    targets.add(id);
  }
  if (targets.size === 0) return;
  write(deleteForMe(db, [...targets], session.me!.id));
}

export { pairId };

// Редактирования сообщений в приложении нет. Если появятся, они обязаны начинаться
// с guard({ conversation }) и не должны экспортировать write().
