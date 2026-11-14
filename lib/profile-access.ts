/**
 * Единая проверка прав на ПУБЛИЧНЫЕ ПРОФИЛИ. Чистый модуль без зависимостей от React / Node:
 * его используют и серверные точки (/api/users/[id], страница /user/[id]), и интерфейс.
 *
 * Правила (те же, что у чатов и личных объявлений):
 *  1. Смотреть чужие профили может только вошедший пользователь с ролью `user`
 *     (admin и moderator работают через свои панели; гость сначала входит).
 *  2. Публичный профиль есть только у пользователя с ролью `user`, не заблокированного.
 *     Профили admin и moderator не публикуются: для остальных они выглядят как «не найден».
 */

export const PROFILE_ROLE = "user";

/** Может ли роль открывать публичные профили. */
export const canViewPublicProfiles = (role: string | null | undefined): boolean => role === PROFILE_ROLE;

/** Есть ли у этого пользователя публичный профиль. */
export const hasPublicProfile = (u: { role?: string | null; blocked?: boolean } | null | undefined): boolean =>
  !!u && u.role === PROFILE_ROLE && !u.blocked;
