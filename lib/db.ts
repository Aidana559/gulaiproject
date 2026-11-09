import { promises as fs } from "fs";
import path from "path";

const dir = path.join(process.cwd(), "data");

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(file: string, data: T) {
  await fs.writeFile(path.join(dir, file), JSON.stringify(data, null, 2), "utf8");
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