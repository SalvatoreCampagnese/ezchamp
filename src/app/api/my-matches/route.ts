import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

// GET /api/my-matches → matches where the user belongs to either team
export const GET = withAuth(async (_req, user) => {
  const { data: tms } = await db
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id);
  const teamIds = (tms ?? []).map((r: { team_id: string }) => r.team_id);
  if (teamIds.length === 0) return NextResponse.json({ matches: [] });

  const inList = teamIds.join(",");
  const { data, error } = await db
    .from("matches")
    .select(
      "*, poster_team:teams!matches_poster_team_id_fkey(id,name), accepter_team:teams!matches_accepter_team_id_fkey(id,name), rule:rules(id,name)",
    )
    .or(`poster_team_id.in.(${inList}),accepter_team_id.in.(${inList})`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ matches: data ?? [] });
});
