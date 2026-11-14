import { NextResponse } from "next/server";
import {
  getBook,
  incrementViews,
  isHiddenNow,
  normalizeGenres,
  patchBook,
  saveCoverFile,
} from "@/lib/books-store";
import { readJson, writeJson } from "@/lib/db";
import {
  bad,
  forbidden,
  getActor,
  isOwner,
  isStaff,
  unauthorized,
} from "@/lib/server-auth";
import {
  approveBook,
  deleteBook,
  hideBook,
  restoreBook,
  setOwnerVisibility,
  sweepExpiredHides,
  unhideBook,
  type Actor,
} from "@/lib/moderation";
import { getBookStates } from "@/lib/bookings";
import { canManageOwnListings, checkListingAccess } from "@/lib/listing-access";
import { REASON_MAX, REASON_MIN } from "@/lib/moderation-shared";
import type { Report, Review, User } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = [
  "title",
  "author",
  "description",
  "category",
  "condition",
  "location",
  "city",
  "campus",
  "year",
  "pages",
] as const;

const MAX_HIDE_DAYS = 730;

const toActor = (u: User): Actor => ({
  id: String(u.id),
  name: u.name,
  role: u.role,
});

/** Срок скрытия: hiddenUntil (ISO-дата) или hideDays. Пусто/null — бессрочно. */
function parseUntil(body: { hiddenUntil?: unknown; hideDays?: unknown }): {
  until: string | null;
  error?: string;
} {
  if (body.hiddenUntil != null && body.hiddenUntil !== "") {
    const t = new Date(String(body.hiddenUntil)).getTime();
    if (Number.isNaN(t)) return { until: null, error: "Неверная дата окончания скрытия" };
    if (t <= Date.now()) return { until: null, error: "Дата окончания скрытия должна быть в будущем" };
    if (t - Date.now() > MAX_HIDE_DAYS * 86_400_000) {
      return { until: null, error: `Скрыть можно не более чем на ${MAX_HIDE_DAYS} дней` };
    }
    return { until: new Date(t).toISOString() };
  }
  const days = Number(body.hideDays);
  if (body.hideDays != null && body.hideDays !== "" && Number.isFinite(days) && days > 0) {
    if (days > MAX_HIDE_DAYS) return { until: null, error: `Скрыть можно не более чем на ${MAX_HIDE_DAYS} дней` };
    return { until: new Date(Date.now() + days * 86_400_000).toISOString() };
  }
  return { until: null };
}

const asBool = (v: unknown) => v === true || v === "true" || v === "1" || v === 1;

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const countView = sp.get("view") !== "0";

  await sweepExpiredHides().catch(() => 0);
  const actor = await getActor(req);
  const book = await getBook(id, { includeHidden: true });
  if (!book || book.deleted) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  if (isHiddenNow(book)) {
    if (!actor || (!isStaff(actor) && !isOwner(book, actor))) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    }
  }

  if (countView) {
    await incrementViews(id);
    book.views = (book.views ?? 0) + 1;
  }

  return NextResponse.json(book);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  const book = await getBook(id, { includeHidden: true, includeDeleted: true });
  if (!book) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const staff = isStaff(actor);
  if (!isOwner(book, actor) && !staff) return forbidden();
  // удалённую книгу можно только восстановить, и только администрации
  if (book.deleted && !staff) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  try {
    const contentType = req.headers.get("content-type") ?? "";
    const patch: Record<string, unknown> = {};
    // действия администрации — отдельно от обычной правки полей
    const mod: {
      hidden?: boolean;
      hiddenUntil?: unknown;
      hideDays?: unknown;
      reason?: string;
      reviewed?: boolean;
      restore?: boolean;
    } = {};

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      for (const k of EDITABLE) {
        if (fd.has(k)) {
          const v = fd.get(k);
          patch[k] = typeof v === "string" ? v.trim().slice(0, 2000) : v;
        }
      }
      // жанры: несколько значений genres (+ признак, что список отправлен, даже если он пуст)
      if (fd.has("genresPresent") || fd.has("genres")) {
        patch.genres = normalizeGenres(fd.getAll("genres").map(String));
      } else if (fd.has("genre")) {
        patch.genres = normalizeGenres(String(fd.get("genre") ?? ""));
      }
      if (fd.has("hidden")) {
        if (!staff) return forbidden();
        mod.hidden = asBool(fd.get("hidden"));
      }
      const file = fd.get("cover");
      if (file && file instanceof File && file.size > 0) {
        patch.coverUrl = await saveCoverFile(file);
      }
      if (fd.get("removeCover") === "1") patch.coverUrl = null;
    } else {
      const body = await req.json();

      // Скрыть / опубликовать снова: только роль user и только владелец. Отдельная операция —
      // она меняет лишь видимость (ownerHidden) и не трогает решения модерации.
      if ("ownerHidden" in body) {
        const access = checkListingAccess(actor, book);
        if (!access.ok) {
          return NextResponse.json({ error: access.message }, { status: access.reason === "unauthenticated" ? 401 : 403 });
        }
        if (book.deleted) return NextResponse.json({ error: "Книга удалена" }, { status: 409 });
        if (isHiddenNow({ hidden: book.hidden, hiddenUntil: book.hiddenUntil })) {
          return NextResponse.json(
            { error: "Объявление скрыто модерацией — публикацией управляет администрация" },
            { status: 409 },
          );
        }
        await setOwnerVisibility(book, toActor(actor), asBool(body.ownerHidden));
        return NextResponse.json(await getBook(id, { includeHidden: true }));
      }

      for (const k of EDITABLE) {
        if (k in body) {
          patch[k] =
            typeof body[k] === "string" ? body[k].trim().slice(0, 2000) : body[k];
        }
      }
      if ("genres" in body) patch.genres = normalizeGenres(body.genres);
      else if ("genre" in body) patch.genres = normalizeGenres(body.genre);

      const staffOnly = ["hidden", "reviewed", "moderationNote", "restore", "reason", "hiddenUntil", "hideDays"];
      if (staffOnly.some((k) => k in body) && !staff) return forbidden();
      if ("hidden" in body) mod.hidden = asBool(body.hidden);
      if ("reviewed" in body) mod.reviewed = asBool(body.reviewed);
      if ("restore" in body) mod.restore = asBool(body.restore);
      mod.hiddenUntil = body.hiddenUntil;
      mod.hideDays = body.hideDays;
      // moderationNote — прежнее имя поля причины (очередь модератора)
      const rawReason = body.reason ?? body.moderationNote;
      if (rawReason != null) mod.reason = String(rawReason).trim().slice(0, REASON_MAX);
      if ("coverUrl" in body) patch.coverUrl = body.coverUrl;
    }

    if (patch.year != null) patch.year = Number(patch.year) || undefined;
    if (patch.pages != null) patch.pages = Number(patch.pages) || 0;
    if (
      patch.condition != null &&
      !["new", "used", "annotated"].includes(String(patch.condition))
    ) {
      return bad("Неверное состояние");
    }
    if (patch.title !== undefined && !patch.title) {
      return bad("Название не может быть пустым");
    }

    const who = toActor(actor);

    // удалённая книга: единственное допустимое действие — восстановление
    if (book.deleted) {
      if (!mod.restore) return NextResponse.json({ error: "Книга удалена" }, { status: 409 });
      await restoreBook(book, who, { reason: mod.reason });
      return NextResponse.json(await getBook(id, { includeHidden: true }));
    }
    if (mod.restore) return bad("Книга не удалена");

    // валидация действий администрации — до любых изменений
    let until: string | null = null;
    if (mod.hidden === true) {
      if (!mod.reason || mod.reason.length < REASON_MIN) {
        return bad(`Укажите причину скрытия (не короче ${REASON_MIN} символов)`);
      }
      const u = parseUntil(mod);
      if (u.error) return bad(u.error);
      until = u.until;
    }

    if (Object.keys(patch).length) await patchBook(id, patch as Partial<typeof book>);

    if (mod.hidden === true) {
      await hideBook(book, who, { reason: mod.reason, until });
      if (mod.reviewed === true && !book.reviewed) await patchBook(id, { reviewed: true });
    } else if (mod.hidden === false) {
      await unhideBook(book, who, { reason: mod.reason });
      if (mod.reviewed === true && !book.reviewed) await approveBook(book, who);
    } else if (mod.reviewed === true) {
      await approveBook(book, who);
    } else if (mod.reviewed === false) {
      await patchBook(id, { reviewed: false });
    }

    return NextResponse.json(await getBook(id, { includeHidden: true }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Ошибка";
    return bad(msg);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const actor = await getActor(req);
  if (!actor) return unauthorized();

  const book = await getBook(id, { includeHidden: true });
  if (!book) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  // «Моя» книга — только в роли user. Администрация удаляет через служебный путь (с причиной).
  const mine = isOwner(book, actor) && canManageOwnListings(actor.role);
  if (!mine && !isStaff(actor)) return forbidden();

  // Автор не может удалить книгу, пока по ней есть активная бронь или выдача.
  // Мягкое удаление сохраняет историю операций (bookings.json не трогаем).
  if (mine) {
    const state = (await getBookStates())[String(book.id)];
    if (state) {
      return NextResponse.json(
        {
          error:
            state === "given"
              ? "Нельзя удалить книгу: она сейчас выдана. Дождитесь возврата."
              : "Нельзя удалить книгу: по ней есть активная бронь. Отмените бронь или дождитесь выдачи и возврата.",
        },
        { status: 409 },
      );
    }
  }

  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = String(body.reason ?? "").trim().slice(0, REASON_MAX);
  if (!mine && reason.length < REASON_MIN) {
    return bad(`Укажите причину удаления (не короче ${REASON_MIN} символов)`);
  }

  await deleteBook(book, toActor(actor), { reason });

  // Автор удаляет своё объявление — как раньше, вместе с отзывами и жалобами.
  // Администрация удаляет «мягко»: отзывы и жалобы остаются, чтобы книгу можно было восстановить.
  if (mine) {
    const reviews = await readJson<Review[]>("reviews.json", []);
    await writeJson(
      "reviews.json",
      reviews.filter((r) => !(r.targetType === "book" && r.targetId === id)),
    );
    const reports = await readJson<Report[]>("reports.json", []);
    await writeJson(
      "reports.json",
      reports.filter((r) => r.bookId !== id),
    );
  }

  return NextResponse.json({ ok: true });
}
