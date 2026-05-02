import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

// Staff-only: full dispute view (match + both teams + evidence).
export const GET = withAdmin<{ params: { id: string } }>(async (_req, _user, { params }) => {
  const { data, error } = await db
    .from("disputes")
    .select(
      "id, match_id, reason, description, status, created_at, resolution_notes, resolved_at, " +
        "opener_team:teams!disputes_opener_team_id_fkey(id,name), " +
        "match:matches!disputes_match_id_fkey(" +
        "id, status, players_per_side, best_of, stake_ton, " +
        "poster_team_id, accepter_team_id, " +
        "poster_team:teams!matches_poster_team_id_fkey(id,name), " +
        "accepter_team:teams!matches_accepter_team_id_fkey(id,name)" +
        ")",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: evidence } = await db
    .from("dispute_evidence")
    .select("id, url, description, created_at")
    .eq("dispute_id", params.id)
    .order("created_at");

  return NextResponse.json({ dispute: data, evidence: evidence ?? [] });
});
