import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

export const GET = withAuth<{ params: { id: string } }>(async (_req, _user, { params }) => {
  const { data, error } = await db
    .from("rules")
    .select("*")
    .eq("game_id", params.id)
    .eq("is_active", true)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rules: data ?? [] });
});
