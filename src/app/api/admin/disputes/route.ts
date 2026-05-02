import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

// Staff-only: list disputes that still need attention.
export const GET = withAdmin(async () => {
  const { data, error } = await db
    .from("disputes")
    .select(
      "id, match_id, reason, description, status, created_at, " +
        "match:matches!disputes_match_id_fkey(" +
        "id, status, players_per_side, best_of, stake_ton, " +
        "poster_team:teams!matches_poster_team_id_fkey(id,name), " +
        "accepter_team:teams!matches_accepter_team_id_fkey(id,name)" +
        ")",
    )
    .in("status", ["open", "investigating"])
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ disputes: data ?? [] });
});
