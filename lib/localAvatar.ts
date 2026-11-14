/**
 * Аватар пользователя из его профиля в ЭТОМ браузере (ключ задаёт AuthProvider.updateProfile).
 * Пока нет серверного хранилища профилей, чужой аватар виден только там, где он был задан;
 * в остальных случаях показывается буква имени (так же, как в списке чатов).
 */
export function localAvatarOf(id?: string | number | null): string | null {
  if (id == null || typeof localStorage === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(`profile-extra:${id}`) ?? "{}").avatar ?? null;
  } catch {
    return null;
  }
}
