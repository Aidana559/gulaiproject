// Клиент-безопасные помощники для уведомлений: группы, заголовки, формат даты.
import { actionHeadline, type ModerationEntry } from "./moderation-shared";

export type NotifType = "booking" | "return" | "moderation" | "info";

export type NotifItem = {
  id: string;
  type: string;
  text: string;
  href?: string;
  read: boolean;
  createdAt: string;
  moderation?: ModerationEntry;
};

export const GROUPS: { type: NotifType; label: string; short: string }[] = [
  { type: "moderation", label: "Мои книги", short: "Модерация" },
  { type: "booking", label: "Бронирования", short: "Бронирование" },
  { type: "return", label: "Сроки возврата", short: "Срок возврата" },
  { type: "info", label: "Прочее", short: "Уведомление" },
];

export function titleOf(n: NotifItem): string {
  if (n.moderation) return actionHeadline(n.moderation);
  return GROUPS.find((g) => g.type === n.type)?.short ?? "Уведомление";
}

const MONTHS = ["янв.", "фев.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."];

/** «9 ноя. 01:28» — для выпадающего списка */
export function fmtShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}:${mm}`;
}
