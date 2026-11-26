import { NextResponse } from "next/server";
import { getAllBooks } from "@/lib/books-store";
import { forbidden, getActor, isStaff, unauthorized } from "@/lib/server-auth";

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return unauthorized();
  if (!isStaff(actor)) return forbidden();
  try {
    const books = await getAllBooks({ includeHidden: true, includeDeleted: true });
    return NextResponse.json({ books });
  } catch (error) {
    console.error("Не удалось загрузить объявления", error);
    return NextResponse.json({ error: "Не удалось загрузить объявления" }, { status: 500 });
  }
}
