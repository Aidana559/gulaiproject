import { NextResponse } from "next/server";
import { getActor, unauthorized } from "@/lib/server-auth";

/**
 * Поиск манги через Jikan (неофициальный API MyAnimeList, без ключа).
 * Отдаём ту же форму, что и /api/google-books, чтобы форма «Добавить издание» заполнялась одинаково.
 * Лимиты Jikan: 3 запроса/сек и 60/мин — поэтому небольшой серверный кэш.
 */

type JikanManga = {
  mal_id: number;
  title?: string;
  title_english?: string | null;
  type?: string | null;
  authors?: { name?: string }[];
  published?: { prop?: { from?: { year?: number | null } } };
  synopsis?: string | null;
  genres?: { name?: string }[];
  demographics?: { name?: string }[];
  images?: { jpg?: { image_url?: string; large_image_url?: string } };
};

// Жанры Jikan → жанры, которые есть в приложении (data/books.ts)
const GENRE_MAP: Record<string, string> = {
  Shounen: "Сёнэн",
  Seinen: "Сэйнэн",
  Shoujo: "Сёдзё",
  Josei: "Сёдзё",
  Adventure: "Приключения",
  Fantasy: "Фэнтези",
  Horror: "Хоррор",
  Mystery: "Детектив",
  "Sci-Fi": "Фантастика",
  Suspense: "Триллер",
};

const SKIP_TYPES = new Set(["Novel", "Light Novel"]);

/** "Arakawa, Hiromu" → "Hiromu Arakawa" (так имена записаны и в каталоге) */
function flipName(n: string) {
  const parts = n.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : n.trim();
}

function cleanSynopsis(s: string) {
  return s
    .replace(/\[Written by MAL Rewrite\]/gi, "")
    .replace(/\(Source:[^)]*\)\s*$/i, "")
    .replace(/\r/g, "")
    .trim();
}

const cache = new Map<string, { at: number; items: unknown[] }>();
const CACHE_TTL = 10 * 60_000;

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ items: [] });

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return NextResponse.json({ items: hit.items });

  const url = new URL("https://api.jikan.moe/v4/manga");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "10");
  url.searchParams.set("sfw", "true");
  url.searchParams.set("order_by", "popularity");
  url.searchParams.set("sort", "asc");

  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (res.status === 429) {
      return NextResponse.json(
        { items: [], error: "Слишком много запросов к MyAnimeList, повторите через пару секунд" },
        { status: 429 },
      );
    }
    if (!res.ok) {
      return NextResponse.json({ items: [], error: "MyAnimeList недоступен" }, { status: 502 });
    }
    const json = (await res.json()) as { data?: JikanManga[] };

    const items = (json.data ?? [])
      .filter((m) => !SKIP_TYPES.has(m.type ?? ""))
      .map((m) => {
        const cover = (m.images?.jpg?.large_image_url ?? m.images?.jpg?.image_url ?? "").trim();
        const names = [...(m.demographics ?? []), ...(m.genres ?? [])]
          .map((g) => GENRE_MAP[g.name ?? ""])
          .filter(Boolean);
        return {
          id: `mal-${m.mal_id}`,
          title: (m.title_english || m.title || "").trim(),
          author: (m.authors ?? []).map((a) => flipName(a.name ?? "")).filter(Boolean).join(", "),
          year: m.published?.prop?.from?.year || undefined,
          pages: undefined,
          description: cleanSynopsis(m.synopsis ?? ""),
          category: "manga",
          genre: names[0] ?? "",
          cover: /^https:\/\/cdn\.myanimelist\.net\//.test(cover) ? cover : "",
        };
      })
      .filter((x) => x.title);

    if (cache.size > 200) cache.clear();
    cache.set(key, { at: Date.now(), items });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], error: "Нет связи с MyAnimeList" }, { status: 502 });
  }
}
