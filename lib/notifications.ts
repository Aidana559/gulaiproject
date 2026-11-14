import { readJson, uid, writeJson } from "@/lib/db";
import { listUsers } from "@/lib/auth";
import type { ModerationEntry } from "@/lib/moderation-shared";

const FILE = "notifications.json";
// Лимит хранения касается только обычных уведомлений (брони, напоминания).
// Уведомления о модерации — это история действий над книгами автора, они не удаляются.
const MAX_PER_USER = 50;

export type NotificationType = "booking" | "return" | "moderation" | "info";

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  text: string;
  href?: string;
  read: boolean;
  createdAt: string;
  key?: string;
  /** для type = "moderation": полная запись о действии администрации */
  moderation?: ModerationEntry;
};

let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

export async function notify(
  userId: string | undefined | null,
  n: {
    type: NotificationType;
    text: string;
    href?: string;
    key?: string;
    moderation?: ModerationEntry;
  },
) {
  if (!userId) return;
  try {
    await withLock(async () => {
      const all = await readJson<Notification[]>(FILE, []);
      if (n.key && all.some((x) => x.userId === userId && x.key === n.key)) return;
      all.push({
        id: uid(),
        userId: String(userId),
        type: n.type,
        text: n.text,
        href: n.href,
        key: n.key,
        moderation: n.moderation,
        read: false,
        createdAt: new Date().toISOString(),
      });
      const mine = all.filter((x) => x.userId === String(userId) && x.type !== "moderation");
      const drop = new Set(
        mine
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(MAX_PER_USER)
          .map((x) => x.id),
      );
      await writeJson(FILE, drop.size ? all.filter((x) => !drop.has(x.id)) : all);
    });
  } catch {

  }
}

/**
 * Несколько уведомлений одному пользователю за одно чтение и (при необходимости) одну запись.
 * Уведомления с уже существующим key пропускаются — как в notify().
 */
export async function notifyMany(
  userId: string | undefined | null,
  items: { type: NotificationType; text: string; href?: string; key?: string }[],
) {
  if (!userId || items.length === 0) return;
  try {
    await withLock(async () => {
      const all = await readJson<Notification[]>(FILE, []);
      const uidStr = String(userId);
      const have = new Set(all.filter((x) => x.userId === uidStr && x.key).map((x) => x.key));
      let added = 0;
      for (const n of items) {
        if (n.key && have.has(n.key)) continue;
        if (n.key) have.add(n.key);
        all.push({
          id: uid(),
          userId: uidStr,
          type: n.type,
          text: n.text,
          href: n.href,
          key: n.key,
          read: false,
          createdAt: new Date().toISOString(),
        });
        added++;
      }
      if (!added) return; // всё уже было — файл не трогаем
      const mine = all.filter((x) => x.userId === uidStr && x.type !== "moderation");
      const drop = new Set(
        mine
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(MAX_PER_USER)
          .map((x) => x.id),
      );
      await writeJson(FILE, drop.size ? all.filter((x) => !drop.has(x.id)) : all);
    });
  } catch {
    /* уведомления не критичны */
  }
}

export async function listFor(userId: string): Promise<Notification[]> {
  const all = await readJson<Notification[]>(FILE, []);
  return all
    .filter((n) => n.userId === String(userId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markRead(
  userId: string,
  opts: { id?: string; ids?: string[]; all?: boolean; types?: string[] },
) {
  const idSet = new Set([...(opts.ids ?? []), ...(opts.id ? [opts.id] : [])]);
  await withLock(async () => {
    const all = await readJson<Notification[]>(FILE, []);
    let changed = false;
    for (const n of all) {
      if (n.userId !== String(userId) || n.read) continue;
      const inScope = !opts.types?.length || opts.types.includes(n.type);
      if ((opts.all && inScope) || idSet.has(n.id)) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) await writeJson(FILE, all);
  });
}

/** id пользователя по ownerId или по имени владельца (у старых книг нет ownerId). */
export async function resolveUserId(o: {
  ownerId?: string | number | null;
  ownerName?: string | null;
}): Promise<string | undefined> {
  if (o.ownerId != null && String(o.ownerId)) return String(o.ownerId);
  if (!o.ownerName) return undefined;
  const users = await listUsers();
  return users.find((u) => u.name === o.ownerName)?.id;
}

/** Удаление уведомлений пользователя: по списку id и/или все прочитанные (в рамках types). */
export async function deleteNotifications(
  userId: string,
  opts: { ids?: string[]; allRead?: boolean; types?: string[] },
): Promise<number> {
  const idSet = new Set(opts.ids ?? []);
  let removed = 0;
  await withLock(async () => {
    const all = await readJson<Notification[]>(FILE, []);
    const keep = all.filter((n) => {
      if (n.userId !== String(userId)) return true;
      const inScope = !opts.types?.length || opts.types.includes(n.type);
      const kill = idSet.has(n.id) || (!!opts.allRead && n.read && inScope);
      if (kill) removed++;
      return !kill;
    });
    if (removed) await writeJson(FILE, keep);
  });
  return removed;
}
