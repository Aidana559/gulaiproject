export async function api<T = any>(
  path: string,
  userId?: string | number,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(userId != null ? { "x-user-id": String(userId) } : {}),
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Ошибка запроса");
  return data as T;
}