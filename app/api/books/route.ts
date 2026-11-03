import { NextResponse } from "next/server";
import { getAllBooks } from "@/lib/books-store";
import { getActor, isStaff } from "@/lib/server-auth";

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const actor = all ? await getActor(req) : null;
  return NextResponse.json(
    await getAllBooks({ includeHidden: !!actor && isStaff(actor) })
  );
}