import { NextResponse } from "next/server";
import { connection } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function GET() {
  await connection();

  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error(error.message);

    return NextResponse.json(
      {
        connected: false,
        message: "Database connection failed",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    connected: true,
    database: "Supabase PostgreSQL",
    users: count,
  });
}