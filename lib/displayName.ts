// Кірген пайдаланушының аты болса: "Вы", әйтпесе нақты аты
export function displayName(
  name: string | undefined | null,
  user: { name: string } | null | undefined
): string {
  if (!name) return "—";
  if (user && name.trim().toLowerCase() === user.name.trim().toLowerCase()) return "Вы";
  return name;
}