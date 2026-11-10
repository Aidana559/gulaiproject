// Запускается один раз при старте сервера Next.js.
// Подгружает каталог из Google Books в фоне (если data/catalog-books.json неполный).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureCatalog } = await import("./lib/catalog-loader");
    void ensureCatalog();
  }
}
