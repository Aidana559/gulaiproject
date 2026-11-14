// Запускается один раз при старте сервера Next.js.
// Подгружает каталог из Google Books в фоне (если data/catalog-books.json неполный)
// и раз в минуту возвращает в каталог книги, у которых истёк срок временного скрытия.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureCatalog } = await import("./lib/catalog-loader");
    void ensureCatalog();

    const { sweepExpiredHides } = await import("./lib/moderation");
    const g = globalThis as unknown as { __modSweeper?: ReturnType<typeof setInterval> };
    if (!g.__modSweeper) {
      const tick = () => void sweepExpiredHides().catch(() => undefined);
      tick();
      g.__modSweeper = setInterval(tick, 60_000);
      g.__modSweeper.unref?.(); // таймер не мешает процессу завершиться
    }
  }
}
