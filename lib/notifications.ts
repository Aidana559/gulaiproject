import { readJson, uid, writeJson } from "@/lib/db";
import { listUsers } from "@/lib/auth";

const FILE = "notifications.json";
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
};

let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

export async function notify(
  userId: string | undefined | null,
  n: { type: NotificationType; text: string; href?: string; key?: string },
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
        read: false,
        createdAt: new Date().toISOString(),
      });
      const mine = all.filter((x) => x.userId === String(userId));
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

export async function listFor(userId: string): Promise<Notification[]> {
  const all = await readJson<Notification[]>(FILE, []);
  return all
    .filter((n) => n.userId === String(userId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markRead(userId: string, opts: { id?: string; all?: boolean }) {
  await withLock(async () => {
    const all = await readJson<Notification[]>(FILE, []);
    let changed = false;
    for (const n of all) {
      if (n.userId !== String(userId) || n.read) continue;
      if (opts.all || n.id === opts.id) {
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