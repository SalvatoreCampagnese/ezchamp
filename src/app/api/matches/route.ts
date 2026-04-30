import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

const PLATFORM_FEE_BPS = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? "500");

// GET /api/matches?game_id=...  → open matches in that game (already paid)
export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const gameId = url.searchParams.get("game_id");
  if (!gameId) return NextResponse.json({ error: "missing_game_id" }, { status: 400 });
  const { data, error } = await db
    .from("matches")
    .select(
      "*, poster_team:teams!matches_poster_team_id_fkey(id,name), rule:rules(id,name)",
    )
    .eq("game_id", gameId)
    .eq("status", "open")
    .not("poster_paid_tx_hash", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ matches: data ?? [] });
});

// POST /api/matches → create a draft (poster pays separately via TON Connect)
export const POST = withAuth(async (req: NextRequest, user) => {
  const body = await req.json();
  const { game_id, rules_id, players_per_side, best_of, stake_ton } = body;
  if (typeof game_id !== "string" || typeof rules_id !== "string") {
    return NextResponse.json({ error: "bad_input" }, { status: 400 });
  }
  if (![1, 2, 3, 5].includes(players_per_side)) {
    return NextResponse.json({ error: "bad_players_per_side" }, { status: 400 });
  }
  if (![1, 3, 5, 7].includes(best_of)) {
    return NextResponse.json({ error: "bad_best_of" }, { status: 400 });
  }
  const stake = Number(stake_ton);
  if (!Number.isFinite(stake) || stake <= 0) {
    return NextResponse.json({ error: "bad_stake" }, { status: 400 });
  }

  // Caller must have a team in this game.
  const { data: tm, error: tmErr } = await db
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .eq("game_id", game_id)
    .maybeSingle();
  if (tmErr) return NextResponse.json({ error: tmErr.message }, { status: 400 });
  if (!tm) return NextResponse.json({ error: "no_team_in_game" }, { status: 400 });

  // Single-match lock.
  const { data: busy, error: busyErr } = await db.rpc("user_has_active_match", {
    p_user_id: user.id,
  });
  if (busyErr) return NextResponse.json({ error: busyErr.message }, { status: 400 });
  if (busy) return NextResponse.json({ error: "user_busy" }, { status: 409 });

  const { data: match, error } = await db
    .from("matches")
    .insert({
      game_id,
      rules_id,
      players_per_side,
      best_of,
      stake_ton: stake.toString(),
      platform_fee_bps: PLATFORM_FEE_BPS,
      poster_team_id: (tm as { team_id: string }).team_id,
      poster_user_id: user.id,
      status: "open",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ match });
});
