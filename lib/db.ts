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