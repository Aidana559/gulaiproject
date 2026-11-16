/**
 * Чистая логика чатов: без React, без localStorage, без сети (поэтому её можно тестировать в Node).
 * Хранилище, сессия и проверки прав — в lib/chatStore.ts и lib/chatAccess.ts.
 *
 * Модель «одна пара пользователей = один чат»:
 *  - id чата = два id участников, отсортированные и склеенные: `${меньший}|${больший}`.
 *    Не зависит ни от книги, ни от того, кто написал первым;
 *  - книга — это не чат, а сообщение типа `book_reference` (карточка) внутри чата;
 *  - прочтение и «удалить у меня» хранятся на каждом сообщении (readBy / hiddenFor), поэтому
 *    при объединении старых переписок ничего не сдвигается и не теряется.
 */

export const MESSAGE_MAX = 2000;
export const STORAGE_VERSION = 2;

export type Party = { id: string; name: string };

/** Минимум о книге, чтобы карточка выглядела правильно, даже если объявление потом скрыто или удалено. */
export type BookSnapshot = { title: string; author: string; coverUrl?: string | null };

type MessageBase = {
  id: string;
  chatId: string;
  /** id отправителя */
  from: string;
  /** дата и время отправки (ISO) */
  at: string;
  /** кто уже прочитал (отправитель — всегда) */
  readBy: string[];
  /** кто удалил у себя («удалить у меня») */
  hiddenFor?: string[];
};
export type TextMessage = MessageBase & { type?: "text"; text: string };
export type BookRefMessage = MessageBase & { type: "book_reference"; bookId: string; book: BookSnapshot };
export type ChatMessage = TextMessage | BookRefMessage;

export type Conversation = {
  /** pairId двух участников */
  id: string;
  /** ровно двое, по возрастанию id */
  participants: [Party, Party];
  messages: ChatMessage[];
  createdAt: string;
};

export type ChatDb = {
  v: typeof STORAGE_VERSION;
  chats: Conversation[];
  /** id старых (v1) переписок, уже объединённых в пары: повторная миграция их пропускает */
  migrated: string[];
};

export const EMPTY_DB: ChatDb = { v: STORAGE_VERSION, chats: [], migrated: [] };

// ---------- идентификаторы и выборки ----------
export const pairId = (x: string, y: string): string => [String(x), String(y)].sort().join("|");

export const isBookRef = (m: ChatMessage): m is BookRefMessage => m.type === "book_reference";

const isHiddenFor = (m: ChatMessage, userId: string) => !!m.hiddenFor?.includes(userId);

export const lastAt = (c: Conversation): string => c.messages[c.messages.length - 1]?.at ?? c.createdAt;

export const otherOf = (c: Conversation, meId: string): Party =>
  c.participants[0].id === meId ? c.participants[1] : c.participants[0];

/** Чат глазами участника: без сообщений, которые он удалил у себя. null — для него чата нет. */
export function viewFor(c: Conversation, meId: string): Conversation | null {
  if (!c.messages.some((m) => isHiddenFor(m, meId))) return c.messages.length ? c : null;
  const messages = c.messages.filter((m) => !isHiddenFor(m, meId));
  return messages.length ? { ...c, messages } : null;
}

export const unreadIn = (c: Conversation, meId: string): number =>
  c.messages.filter((m) => m.from !== meId && !m.readBy.includes(meId) && !isHiddenFor(m, meId)).length;

/** Короткий текст сообщения для списка чатов: у карточки книги — её название. */
export const previewOf = (m: ChatMessage | undefined): string =>
  !m ? "" : isBookRef(m) ? ` «${m.book.title}»` : m.text;

// ---------- операции (чистые: возвращают новое состояние) ----------
const sortParties = (a: Party, b: Party): [Party, Party] => (a.id <= b.id ? [a, b] : [b, a]);

function put(db: ChatDb, chat: Conversation): ChatDb {
  const i = db.chats.findIndex((c) => c.id === chat.id);
  const chats = i === -1 ? [...db.chats, chat] : db.chats.map((c, k) => (k === i ? chat : c));
  return { ...db, chats };
}

/** Найти чат пары или подготовить новый (в хранилище он попадёт вместе с первым сообщением). */
function findOrNew(db: ChatDb, me: Party, peer: Party, now: string): Conversation {
  const id = pairId(me.id, peer.id);
  const found = db.chats.find((c) => c.id === id);
  if (!found) return { id, participants: sortParties(me, peer), messages: [], createdAt: now };
  // имена в записи подновляем (они лишь для показа; идентифицирует участника только id)
  const names = new Map([[me.id, me.name], [peer.id, peer.name]]);
  const p = found.participants.map((x) => ({ id: x.id, name: names.get(x.id) || x.name })) as [Party, Party];
  return p[0].name === found.participants[0].name && p[1].name === found.participants[1].name
    ? found
    : { ...found, participants: p };
}

/**
 * «Написать владельцу»: находит чат пары (или создаёт) и добавляет карточку книги.
 * Карточка той же книги, которую `me` уже видит в этом чате, повторно не добавляется.
 */
export function openBook(
  db: ChatDb,
  args: {
    me: Party;
    owner: Party;
    book: { id: string } & BookSnapshot;
    now: string;
    newId: () => string;
  },
): { db: ChatDb; chatId: string; added: boolean } {
  const { me, owner, book, now, newId } = args;
  const chat = findOrNew(db, me, owner, now);
  const already = chat.messages.some((m) => isBookRef(m) && m.bookId === book.id && !isHiddenFor(m, me.id));
  if (already) return { db: chat === db.chats.find((c) => c.id === chat.id) ? db : put(db, chat), chatId: chat.id, added: false };

  const card: BookRefMessage = {
    id: newId(),
    chatId: chat.id,
    type: "book_reference",
    from: me.id,
    bookId: book.id,
    book: { title: book.title, author: book.author, coverUrl: book.coverUrl ?? null },
    at: now,
    readBy: [me.id],
  };
  return { db: put(db, { ...chat, messages: [...chat.messages, card] }), chatId: chat.id, added: true };
}

/**
 * «Написать» из профиля: находит чат пары (один на двух пользователей) или готовит пустой.
 * Если чат пары уже есть, второй не создаётся. Пустой чат в списках не виден (viewFor),
 * пока в нём нет сообщений; переписка пары всегда одна и та же запись.
 */
export function openPair(
  db: ChatDb,
  args: { me: Party; peer: Party; now: string },
): { db: ChatDb; chatId: string } {
  const chat = findOrNew(db, args.me, args.peer, args.now);
  const stored = db.chats.find((c) => c.id === chat.id);
  return { db: chat === stored ? db : put(db, chat), chatId: chat.id };
}

export function addText(
  db: ChatDb,
  args: { chatId: string; meId: string; text: string; now: string; id: string },
): ChatDb {
  const chat = db.chats.find((c) => c.id === args.chatId);
  const text = args.text.trim().slice(0, MESSAGE_MAX);
  if (!chat || !text) return db;
  const m: TextMessage = {
    id: args.id,
    chatId: chat.id,
    type: "text",
    from: args.meId,
    text,
    at: args.now,
    readBy: [args.meId],
  };
  return put(db, { ...chat, messages: [...chat.messages, m] });
}

/** Отметить прочитанным всё видимое участнику (только за него). */
export function markSeen(db: ChatDb, chatId: string, meId: string): ChatDb {
  const chat = db.chats.find((c) => c.id === chatId);
  if (!chat) return db;
  const todo = (m: ChatMessage) => !m.readBy.includes(meId) && !isHiddenFor(m, meId);
  if (!chat.messages.some(todo)) return db;
  return put(db, {
    ...chat,
    messages: chat.messages.map((m) => (todo(m) ? { ...m, readBy: [...m.readBy, meId] } : m)),
  });
}

/**
 * «Удалить у меня»: скрывает у участника всю текущую историю. Собеседник сохраняет переписку;
 * когда у обоих скрыто всё — запись стирается. Новое сообщение вернёт чат без удалённой истории.
 */
export function deleteForMe(db: ChatDb, chatIds: string[], meId: string): ChatDb {
  const ids = new Set(chatIds);
  const chats: Conversation[] = [];
  for (const c of db.chats) {
    if (!ids.has(c.id)) {
      chats.push(c);
      continue;
    }
    const messages = c.messages.map((m) =>
      isHiddenFor(m, meId) ? m : { ...m, hiddenFor: [...(m.hiddenFor ?? []), meId], readBy: m.readBy.includes(meId) ? m.readBy : [...m.readBy, meId] },
    );
    const everyoneHidden = messages.every((m) => c.participants.every((p) => isHiddenFor(m, p.id)));
    if (!everyoneHidden) chats.push({ ...c, messages });
  }
  return { ...db, chats };
}

// ---------- миграция со старой модели (v1: один чат = книга + читатель + владелец) ----------
export type LegacyConversation = {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  buyer: { id: string; name: string };
  owner: { id?: string; name: string };
  messages: { id: string; from: "buyer" | "owner"; text: string; at: string }[];
  /** сколько сообщений прочитала каждая сторона */
  seen?: { buyer?: number; owner?: number };
  createdAt: string;
  /** id участника → сколько сообщений он удалил у себя */
  cleared?: Record<string, number>;
};

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

export function sortChronologically(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .map((m, i) => ({ m, i }))
    .sort(
      (a, b) =>
        time(a.m.at) - time(b.m.at) ||
        Number(isBookRef(b.m)) - Number(isBookRef(a.m)) || // при равном времени карточка раньше сообщений
        a.i - b.i,
    )
    .map((x) => x.m);
}

/**
 * Безопасно и повторяемо вливает старые переписки в чаты пар.
 *  - ничего не удаляет (исходные данные остаются в старом ключе);
 *  - id сообщений сохраняются, дубликаты по id не добавляются;
 *  - авторов (по id), время, статусы прочтения и «удалено у меня» переносит на сообщения;
 *  - книга старой переписки становится карточкой (id `legacy-book:<id>`), если такой книги в чате ещё нет;
 *  - переписку, где собеседника нельзя определить по id, не трогает: она остаётся «ожидающей».
 */
export function migrateLegacy(
  db: ChatDb,
  legacy: LegacyConversation[],
  resolveByName: (name: string) => string | undefined,
): { db: ChatDb; merged: number; pending: number } {
  const done = new Set(db.migrated);
  let out = db;
  let merged = 0;
  let pending = 0;

  for (const L of legacy) {
    if (!L || !L.id || done.has(L.id)) continue;
    const buyerId = L.buyer?.id ? String(L.buyer.id) : undefined;
    const ownerId = L.owner?.id ? String(L.owner.id) : resolveByName(L.owner?.name ?? "");
    if (!buyerId || !ownerId || buyerId === ownerId) {
      pending++;
      continue;
    }
    const buyer: Party = { id: buyerId, name: L.buyer.name };
    const owner: Party = { id: ownerId, name: L.owner.name };
    const id = pairId(buyerId, ownerId);
    const created = time(L.createdAt) ? L.createdAt : undefined;
    const first = L.messages[0]?.at;
    const chat = out.chats.find((c) => c.id === id) ?? {
      id,
      participants: sortParties(buyer, owner),
      messages: [] as ChatMessage[],
      createdAt: created ?? first ?? new Date(0).toISOString(),
    };

    const total = L.messages.length;
    const cleared = (uid: string) => L.cleared?.[uid] ?? 0;
    const hiddenFor = (uid: string, i: number) => cleared(uid) > i;
    const have = new Set(chat.messages.map((m) => m.id));
    const add: ChatMessage[] = [];

    L.messages.forEach((m, i) => {
      if (have.has(m.id)) return; // уже перенесено раньше — не дублируем
      const fromBuyer = m.from === "buyer";
      const sender = fromBuyer ? buyerId : ownerId;
      const other = fromBuyer ? ownerId : buyerId;
      const otherSeen = (fromBuyer ? L.seen?.owner : L.seen?.buyer) ?? 0;
      const hidden = [buyerId, ownerId].filter((uid) => hiddenFor(uid, i));
      add.push({
        id: m.id,
        chatId: id,
        type: "text",
        from: sender,
        text: m.text,
        at: m.at,
        readBy: i < otherSeen ? [sender, other] : [sender],
        ...(hidden.length ? { hiddenFor: hidden } : {}),
      });
    });

    // карточка книги старой переписки
    const cardId = `legacy-book:${L.id}`;
    const bookId = String(L.bookId);
    const hasCard = chat.messages.some((m) => m.id === cardId || (isBookRef(m) && m.bookId === bookId));
    if (!hasCard) {
      const cardAt =
        created && first ? (time(first) < time(created) ? first : created) : (created ?? first ?? new Date(0).toISOString());
      const hidden = [buyerId, ownerId].filter((uid) => total > 0 && cleared(uid) >= total);
      add.push({
        id: cardId,
        chatId: id,
        type: "book_reference",
        from: buyerId,
        bookId,
        book: { title: L.bookTitle, author: L.bookAuthor, coverUrl: null },
        at: cardAt,
        readBy: [buyerId, ownerId], // служебная карточка: непрочитанным не считается
        ...(hidden.length ? { hiddenFor: hidden } : {}),
      });
    }

    const messages = sortChronologically([...chat.messages, ...add]);
    const createdAt = messages.length && time(messages[0].at) < time(chat.createdAt) ? messages[0].at : chat.createdAt;
    const next: Conversation = { ...chat, messages, createdAt };
    out = put(out, next);
    out = { ...out, migrated: [...out.migrated, L.id] };
    done.add(L.id);
    merged++;
  }
  return { db: out, merged, pending };
}

// ---------- разбор данных из хранилища ----------
export function parseDb(raw: string | null): ChatDb {
  if (!raw) return EMPTY_DB;
  try {
    const p = JSON.parse(raw) as Partial<ChatDb> | null;
    if (!p || p.v !== STORAGE_VERSION || !Array.isArray(p.chats)) return EMPTY_DB;
    const chats = p.chats.filter(
      (c): c is Conversation =>
        !!c && typeof c.id === "string" && Array.isArray(c.participants) && c.participants.length === 2 && Array.isArray(c.messages),
    );
    return { v: STORAGE_VERSION, chats, migrated: Array.isArray(p.migrated) ? p.migrated.map(String) : [] };
  } catch {
    return EMPTY_DB;
  }
}

export function parseLegacy(raw: string | null): LegacyConversation[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as LegacyConversation[]) : [];
  } catch {
    return [];
  }
}
