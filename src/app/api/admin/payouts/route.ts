import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

// Pending payouts dashboard data. We surface the match (so the admin can
// click into the detail view) and the would-be recipient. Confirmed
// payouts are excluded — those have a tx hash and are settled.
export const GET = withAdmin(async () => {
  const { data, error } = await db
    .from("transactions")
    .select(
      "id, match_id, amount_ton, status, created_at, signed_at, signed_by_user_id, " +
        "user:users!transactions_user_id_fkey(id, telegram_username, wallet_address), " +
        "match:matches(" +
        "id, status, players_per_side, best_of, stake_ton, " +
        "winner_team_id, " +
        "poster_team:teams!matches_poster_team_id_fkey(id,name), " +
        "accepter_team:teams!matches_accepter_team_id_fkey(id,name)" +
        ")",
    )
    .eq("type", "payout")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ payouts: data ?? [] });
});
