import { NextResponse } from "next/server";
import { getActor, unauthorized } from "@/lib/server-auth";

type Volume = {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ items: [] });

  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", q);
  url.searchParams.set("maxResults", "8");
  url.searchParams.set("printType", "books");
  if (key) url.searchParams.set("key", key);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ items: [], error: "Google Books недоступен" }, { status: 502 });
    }
    const json = (await res.json()) as { items?: Volume[] };
    const items = (json.items ?? [])
      .map((v) => {
        const i = v.volumeInfo ?? {};
        const thumb = (i.imageLinks?.thumbnail ?? i.imageLinks?.smallThumbnail ?? "").replace(
          /^http:\/\//,
          "https://",
        );
        const year = Number((i.publishedDate ?? "").slice(0, 4)) || undefined;
        return {
          id: v.id,
          title: i.title ?? "",
          author: (i.authors ?? []).join(", "),
          year,
          pages: i.pageCount || undefined,
          description: i.description ?? "",
          category: i.categories?.[0] ?? "",
          cover: thumb,
        };
      })
      .filter((x) => x.title);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], error: "Нет связи с Google Books" }, { status: 502 });
  }
}