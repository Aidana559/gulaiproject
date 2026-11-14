import path from "path";
import { promises as fsp } from "node:fs";
import { readTextRetry, writeFileAtomic } from "./atomic-file";

const dir = path.join(process.cwd(), "data");

/**
 * Кэш разобранных JSON-файлов. Раньше каждый запрос заново читал и разбирал файлы
 * (каталог ~190 КБ, брони, пользователи…). Теперь файл перечитывается только если он изменился:
 * проверяется дешёвый stat (mtime + размер + inode). Запись через writeJson обновляет кэш сразу.
 * Ключ в globalThis: в dev-режиме Next может создать модуль несколько раз.
 */
type Entry = { sig: string; data: unknown };
const gc = globalThis as unknown as { __jsonCache?: Map<string, Entry> };
const cache = (gc.__jsonCache ??= new Map<string, Entry>());

const sigOf = (st: { mtimeMs: number; size: number; ino: number }) => `${st.mtimeMs}:${st.size}:${st.ino}`;

async function loadCached(file: string): Promise<unknown> {
  const full = path.join(dir, file);
  const st = await fsp.stat(full); // ENOENT -> бросает, вызывающий вернёт fallback
  const sig = sigOf(st);
  const hit = cache.get(full);
  if (hit && hit.sig === sig) return hit.data;
  const data = JSON.parse(await readTextRetry(full));
  cache.set(full, { sig, data });
  return data;
}

/** Копия данных: можно спокойно менять (push, sort…) и затем записывать через writeJson. */
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return structuredClone(await loadCached(file)) as T;
  } catch {
    return fallback;
  }
}

/**
 * ОБЩИЙ экземпляр из кэша, без копирования. Только для чтения: менять результат нельзя
 * (иначе испортится кэш). Для горячих путей, где данные лишь фильтруются и отдаются.
 */
export async function readJsonShared<T>(file: string, fallback: T): Promise<T> {
  try {
    return (await loadCached(file)) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(file: string, data: T) {
  const full = path.join(dir, file);
  cache.delete(full);
  await writeFileAtomic(full, JSON.stringify(data, null, 2));
}

export const uid = () => crypto.randomUUID();

const g = globalThis as unknown as { __locks?: Map<string, Promise<unknown>> };
const locks = (g.__locks ??= new Map<string, Promise<unknown>>());

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(key, run.catch(() => undefined));
  return run;
}