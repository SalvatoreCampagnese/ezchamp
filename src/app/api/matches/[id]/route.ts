import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

export const GET = withAuth<{ params: { id: string } }>(async (_req, _user, { params }) => {
  const { data, error } = await db
    .from("matches")
    .select(
      "*, poster_team:teams!matches_poster_team_id_fkey(id,name), accepter_team:teams!matches_accepter_team_id_fkey(id,name), rule:rules(id,name)",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ match: data });
});
