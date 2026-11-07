import { NextResponse } from "next/server";
import {
  createBook,
  listBooks,
  saveCoverFile,
  type Condition,
} from "@/lib/books-store";
import { bad, getActor, isStaff, unauthorized } from "@/lib/server-auth";
import { isMutedNow, muteLabel } from "@/lib/mute";
import type { Category } from "@/data/books";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const actor = await getActor(req);
  const includeHidden = sp.get("all") === "1" && !!actor && isStaff(actor);

  const result = await listBooks({
    q: sp.get("q") ?? undefined,
    category: sp.get("category") ?? undefined,
    genre: sp.get("genre") ?? undefined,
    author: sp.get("author") ?? undefined,
    year: Number(sp.get("year")) || undefined,
    status: sp.get("status") ?? undefined,
    sort: (sp.get("sort") as "title" | "new" | "popular") || "title",
    page: Number(sp.get("page") || 1) || 1,
    limit: Number(sp.get("limit") || 24) || 24,
    includeHidden,
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  if (isMutedNow(actor)) {
    const why = actor.muteReason ? ` Причина: ${actor.muteReason}.` : "";
    return NextResponse.json(
      { error: `Вам запрещено публиковать объявления (${muteLabel(actor)}).${why}` },
      { status: 403 },
    );
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let title = "";
    let author = "";
    let category: Category = "book";
    let genre = "";
    let year: number | undefined;
    let pages: number | undefined;
    let city = "";
    let campus = "";
    let description = "";
    let condition: Condition = "used";
    let coverUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      title = String(fd.get("title") ?? "").trim();
      author = String(fd.get("author") ?? "").trim();
      category = (String(fd.get("category") ?? "book") as Category) || "book";
      genre = String(fd.get("genre") ?? "").trim();
      const yearRaw = String(fd.get("year") ?? "");
      const pagesRaw = String(fd.get("pages") ?? "");
      year = yearRaw ? Number(yearRaw) : undefined;
      pages = pagesRaw ? Number(pagesRaw) : undefined;
      city = String(fd.get("city") ?? "").trim();
      campus = String(fd.get("campus") ?? "").trim();
      description = String(fd.get("description") ?? "").trim();
      condition = (String(fd.get("condition") ?? "used") as Condition) || "used";
      const file = fd.get("cover");
      if (file && file instanceof File && file.size > 0) {
        coverUrl = await saveCoverFile(file);
      } else {
        const gUrl = String(fd.get("coverUrl") ?? "").trim();
        if (/^https:\/\/books\.google\.com\//.test(gUrl)) coverUrl = gUrl;
      }
    } else {
      const body = await req.json();
      title = String(body.title ?? "").trim();
      author = String(body.author ?? "").trim();
      category = (body.category as Category) || "book";
      genre = String(body.genre ?? "").trim();
      year = body.year ? Number(body.year) : undefined;
      pages = body.pages ? Number(body.pages) : undefined;
      city = String(body.city ?? "").trim();
      campus = String(body.campus ?? "").trim();
      description = String(body.description ?? "").trim();
      condition = (body.condition as Condition) || "used";
      coverUrl = body.coverUrl ?? null;
    }

    if (title.length < 2) return bad("Укажите название");
    if (author.length < 2) return bad("Укажите автора");
    if (!["book", "textbook", "guide", "manga"].includes(category)) {
      return bad("Неверная категория");
    }
    if (!["new", "used", "annotated"].includes(condition)) {
      return bad("Неверное состояние");
    }

    const book = await createBook({
      title,
      author,
      category,
      genre,
      year,
      pages,
      city,
      campus,
      description,
      condition,
      coverUrl,
      ownerId: String(actor.id),
      ownerName: actor.name,
    });

    return NextResponse.json({ book }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Ошибка сохранения";
    return bad(msg);
  }
}