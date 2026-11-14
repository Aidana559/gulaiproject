/**
 * Единая проверка прав на чаты. Чистый модуль без зависимостей от React / Node:
 * его используют и клиентское хранилище (lib/chatStore.ts), и серверные точки
 * (страница /messages, /api/chat/directory), поэтому правила не дублируются.
 *
 * Правила:
 *  1. Чатами пользуются только вошедшие пользователи с ролью `user` (admin и moderator — нет).
 *  2. Читать и менять переписку может только её участник (по id, не по имени).
 *  3. Писать (создавать диалог, отправлять сообщение) можно только если ОБА участника — `user`.
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

/** Минимум, который нужно знать о диалоге для проверки прав. */
export type ChatParties = { buyer: { id: string }; owner: { id?: string } };

/** Кем является actor в диалоге. Только по id: имя не идентификатор. */
export function participantRole(c: ChatParties, actorId: string): "buyer" | "owner" | null {
  if (c.buyer.id === actorId) return "buyer";
  if (c.owner.id && c.owner.id === actorId) return "owner";
  return null;
}

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

  const me = participantRole(c, actor.id);
  if (!me) return deny("not-participant");

  if (check.write) {
    const peerId = me === "buyer" ? c.owner.id : c.buyer.id;
    if (!peerId) return deny("peer-unknown");
    if (peerId === actor.id) return deny("self");
    if (!check.eligibleIds) return deny("peer-unknown");
    if (!check.eligibleIds.has(peerId)) return deny("peer-role");
  }
  return { ok: true };
}
