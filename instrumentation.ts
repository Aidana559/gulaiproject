// Запускается один раз при старте сервера Next.js.
// Подгружает каталог из Google Books в фоне (если data/catalog-books.json неполный)
// и раз в минуту возвращает в каталог книги, у которых истёк срок временного скрытия.
export async function register() {
  // Next.js задаёт NEXT_RUNTIME только на сервере; process доступен в Node.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).process?.env as Record<string, string | undefined> | undefined;
  if (env?.NEXT_RUNTIME !== "nodejs") return;

  const { ensureCatalog } = await import("./lib/catalog-loader");
  void ensureCatalog();

  const { sweepExpiredHides } = await import("./lib/moderation");
  const g = globalThis as unknown as {
    __modSweeper?: ReturnType<typeof setInterval> | NodeJS.Timeout;
  };
  if (!g.__modSweeper) {
    const tick = () => void sweepExpiredHides().catch(() => undefined);
    tick();
    const id = setInterval(tick, 60_000);
    // В Node setInterval возвращает Timeout с unref(); в DOM-типах — number.
    if (typeof id === "object" && id !== null && "unref" in id) {
      (id as NodeJS.Timeout).unref();
    }
    g.__modSweeper = id;
  }
}
