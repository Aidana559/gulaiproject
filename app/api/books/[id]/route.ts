import { NextResponse } from "next/server";
import {
  getBook,
  incrementViews,
  patchBook,
  saveCoverFile,
  softDeleteBook,
  type Condition,
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
import type { Report, Review } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = [
  "title",
  "author",
  "description",
  "genre",
  "category",
  "condition",
  "status",
  "location",
  "city",
  "campus",
  "isbn",
  "year",
  "pages",
] as const;

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const countView = sp.get("view") !== "0";

  const actor = await getActor(req);
  const book = await getBook(id, { includeHidden: true });
  if (!book || book.deleted) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  if (book.hidden) {
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

  const book = await getBook(id, { includeHidden: true });
  if (!book || book.deleted) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  if (!isOwner(book, actor) && !isStaff(actor)) return forbidden();

  try {
    const contentType = req.headers.get("content-type") ?? "";
    const patch: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      for (const k of EDITABLE) {
        if (fd.has(k)) {
          const v = fd.get(k);
          patch[k] = typeof v === "string" ? v.trim().slice(0, 2000) : v;
        }
      }
      if (fd.has("hidden") && isStaff(actor)) {
        patch.hidden = String(fd.get("hidden")) === "true" || fd.get("hidden") === "1";
      }
      const file = fd.get("cover");
      if (file && file instanceof File && file.size > 0) {
        patch.coverUrl = await saveCoverFile(file);
      }
      if (fd.get("removeCover") === "1") patch.coverUrl = null;
    } else {
      const body = await req.json();
      for (const k of EDITABLE) {
        if (k in body) {
          patch[k] =
            typeof body[k] === "string" ? body[k].trim().slice(0, 2000) : body[k];
        }
      }
      if ("hidden" in body) {
        if (!isStaff(actor)) return forbidden();
        patch.hidden = !!body.hidden;
      }
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

    const updated = await patchBook(id, patch as Partial<typeof book>);
    return NextResponse.json(updated);
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
  if (!isOwner(book, actor) && !isStaff(actor)) return forbidden();

  await softDeleteBook(id);

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

  return NextResponse.json({ ok: true });
}
