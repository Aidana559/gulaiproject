import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Безопасная запись/чтение JSON-файлов данных (data/*.json).
 *
 * Раньше файлы писались через fs.writeFile: он СНАЧАЛА обнуляет файл и только потом
 * пишет содержимое. Любое чтение в этот момент (а читают на каждый запрос: /api/auth/me,
 * уведомления, чат…) видело пустой/обрезанный файл, а код превращал это в «[]».
 * Здесь файл пишется во временный и атомарно подменяется (rename): читатель всегда видит
 * либо старую, либо новую полную версию.
 */

const RETRY = new Set(["EPERM", "EBUSY", "EACCES"]); // Windows: файл на миг занят антивирусом/другим процессом
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(op: () => Promise<T>, tries = 8): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await op();
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (i >= tries - 1 || !code || !RETRY.has(code)) throw e;
      await sleep(15 * (i + 1));
    }
  }
}

export const readTextRetry = (file: string) => withRetry(() => fs.readFile(file, "utf8"));

export async function writeFileAtomic(file: string, data: string, opts: { backup?: boolean } = {}) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  const fh = await fs.open(tmp, "w");
  try {
    await fh.writeFile(data, "utf8");
    await fh.sync(); // данные на диске до подмены файла
  } finally {
    await fh.close();
  }
  try {
    // .bak = предыдущая рабочая версия, для ручного восстановления
    if (opts.backup) await fs.copyFile(file, `${file}.bak`).catch(() => undefined);
    await withRetry(() => fs.rename(tmp, file));
  } catch (e) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw e;
  }
}
