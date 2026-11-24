import { NextResponse } from "next/server";
import {
  createBook,
  listBooks,
  normalizeGenres,
  saveCoverFile,
  type Condition,
} from "@/lib/books-store";
import { bad, forbidden, getActor, isStaff, unauthorized } from "@/lib/server-auth";
import { canManageOwnListings, checkListingAccess } from "@/lib/listing-access";
import { sweepExpiredHides } from "@/lib/moderation";
import { isMutedNow, muteLabel } from "@/lib/mute";
import type { Category } from "@/data/books";
import { isCategory } from "@/lib/categories";
import { getTaxonomy } from "@/lib/taxonomy-store";
import { catalogIsEmpty, ensureCatalog } from "@/lib/catalog-loader";

export async function GET(req: Request) {
  // Каталог догружается из Google Books В ФОНЕ: запрос его не ждёт.
  // Ждём (не дольше 8 с) только при самом первом запуске, когда каталог ещё пуст.
  const loading = ensureCatalog();
  if (await catalogIsEmpty()) await Promise.race([loading, new Promise((r) => setTimeout(r, 8000))]);

  // книги с истёкшим сроком скрытия возвращаются в каталог (и автору уходит уведомление)
  await sweepExpiredHides().catch(() => 0);

  const sp = new URL(req.url).searchParams;
  const actor = await getActor(req);
  const staffAll = sp.get("all") === "1" && !!actor && isStaff(actor);
  // mine=1 — «Мои объявления»: свои книги в любом состоянии (скрытые и удалённые тоже)
  // «Мои объявления» — только для роли user (admin и moderator работают через свои панели)
  if (sp.get("mine") === "1" && actor && !canManageOwnListings(actor.role)) return forbidden();
  const mine = sp.get("mine") === "1" && !!actor;
  const includeHidden = staffAll || mine;
  const stateParam = sp.get("state") ?? undefined;
  const state = (["published", "pending", "hidden", "deleted", "all"] as const).find((x) => x === stateParam);
  // удалённые отдаём только по явному запросу администрации (state=deleted|all) или автору (mine=1)
  const includeDeleted = mine || (staffAll && (state === "deleted" || state === "all"));

  const result = await listBooks({
    q: sp.get("q") ?? undefined,
    category: sp.get("category") ?? undefined,
    // жанр можно повторять: ?genre=Фэнтези&genre=Романтика — нужны книги со всеми жанрами
    genre: sp.getAll("genre"),
    state: includeHidden ? state : undefined,
    owner: mine && actor ? { id: String(actor.id), name: actor.name } : undefined,
    includeDeleted,
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

  // Добавлять личные книги может только роль user; роль берётся из серверной сессии
  const access = checkListingAccess(actor);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: 403 });

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
    let genres: string[] = [];
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
      genres = normalizeGenres([...fd.getAll("genres"), ...(fd.has("genres") ? [] : fd.getAll("genre"))].map(String));
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
      genres = normalizeGenres(body.genres ?? body.genre);
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
    await getTaxonomy(); // актуальный список категорий (их добавляет администратор)
    if (!isCategory(category)) {
      return bad("Неверная категория");
    }
    if (!["new", "used", "annotated"].includes(condition)) {
      return bad("Неверное состояние");
    }

    const book = await createBook({
      title,
      author,
      category,
      genres,
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