/**
 * Единая проверка прав на чаты. Чистый модуль без зависимостей от React / Node:
 * его используют и клиентское хранилище (lib/chatStore.ts), и серверные точки
 * (страница /messages, /api/chat/directory), поэтому правила не дублируются.
 *
 * Правила:
 *  1. Чатами пользуются только вошедшие пользователи с ролью `user` (admin и moderator — нет).
 *  2. Читать и менять переписку может только её участник (по id, не по имени).
 *  3. Писать (создавать диалог, отправлять сообщение) можно только если ОБА участника — `user`.
 *  4. Личный чат принадлежит ПАРЕ пользователей (двум id), а не книге.
 */

export const CHAT_ROLE = "user";

/** Текущий пользователь так, как его отдала серверная сессия (/api/auth/me). */
export type ChatActor = { id: string; name: string; role: string };

export type ChatDenyReason =
  | "unauthenticated" // не вошёл
  | "role" // роль admin / moderator (или неизвестная)
  | "not-participant" // чужая переписка
  | "peer-role" // собеседник не имеет роли user
  | "peer-unknown" // собеседника не удалось подтвердить
  | "self"; // переписка с самим собой

export type ChatDecision = { ok: true } | { ok: false; reason: ChatDenyReason; message: string };

export const CHAT_DENY_MESSAGES: Record<ChatDenyReason, string> = {
  unauthenticated: "Войдите, чтобы пользоваться сообщениями.",
  role: "Сообщения доступны только обычным пользователям.",
  "not-participant": "Вы не участник этой переписки.",
  "peer-role": "Переписка возможна только между обычными пользователями.",
  "peer-unknown": "Не удалось подтвердить собеседника. Обновите страницу и повторите.",
  self: "Писать самому себе нельзя.",
};

export class ChatAccessError extends Error {
  readonly reason: ChatDenyReason;
  constructor(reason: ChatDenyReason) {
    super(CHAT_DENY_MESSAGES[reason]);
    this.name = "ChatAccessError";
    this.reason = reason;
  }
}

/** Роль вообще может пользоваться чатами? Используется и для скрытия интерфейса. */
export const canUseChat = (role: string | null | undefined): boolean => role === CHAT_ROLE;

/** Минимум, который нужно знать о диалоге: личный чат = ровно два участника (по id). */
export type ChatParties = { participants: readonly [{ id: string }, { id: string }] };

/** Является ли actor участником. Только по id: имя не идентификатор. */
export const isParticipant = (c: ChatParties, actorId: string): boolean =>
  c.participants.some((p) => p.id === actorId);

/** id собеседника (для чата с самим собой вернёт свой же id — такой чат запрещён проверкой `self`). */
export const peerIdOf = (c: ChatParties, actorId: string): string =>
  c.participants[0].id === actorId ? c.participants[1].id : c.participants[0].id;

export type ChatCheck = {
  /** Диалог, с которым работает операция (для чтения/изменения существующего или создания нового). */
  conversation?: ChatParties;
  /**
   * Операция пишет в переписку (создание, отправка): дополнительно требуется, чтобы
   * оба участника были `user` по справочнику, полученному с сервера.
   */
  write?: boolean;
  /** id пользователей с ролью `user` (справочник сервера). null — не загружен. */
  eligibleIds?: ReadonlySet<string> | null;
};

const deny = (reason: ChatDenyReason): ChatDecision => ({
  ok: false,
  reason,
  message: CHAT_DENY_MESSAGES[reason],
});

/**
 * ЕДИНАЯ функция проверки доступа к операциям чата.
 * `actor` обязан приходить из серверной сессии, а не из аргументов вызывающего кода.
 */
export function checkChatAccess(actor: ChatActor | null | undefined, check: ChatCheck = {}): ChatDecision {
  if (!actor) return deny("unauthenticated");
  if (!canUseChat(actor.role)) return deny("role");

  const c = check.conversation;
  if (!c) return { ok: true };

  if (!isParticipant(c, actor.id)) return deny("not-participant");

  if (check.write) {
    const [x, y] = c.participants;
    if (!x.id || !y.id) return deny("peer-unknown");
    if (x.id === y.id) return deny("self");
    const peerId = peerIdOf(c, actor.id);
    if (!check.eligibleIds) return deny("peer-unknown");
    if (!check.eligibleIds.has(peerId)) return deny("peer-role");
  }
  return { ok: true };
}
