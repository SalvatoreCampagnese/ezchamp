import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

/**
 * POST /api/queue/join
 *   body: { game_id, rules_id, players_per_side, best_of, entry_fee_ton }
 *
 * Creates a queue_entry in `pending_payment`. The webapp follows up by
 * sending TON via TonConnect with the comment `EZQ:<entry.id>`. The bot's
 * payment sweeper calls `mark_queue_entry_paid` once the chain confirms.
 */
export const POST = withAuth(async (req: NextRequest, user) => {
  const body = await req.json();
  const { game_id, rules_id, players_per_side, best_of, entry_fee_ton } = body;

  if (typeof game_id !== "string" || typeof rules_id !== "string") {
    return NextResponse.json({ error: "bad_input" }, { status: 400 });
  }
  if (![1, 2, 3, 4, 5].includes(players_per_side)) {
    return NextResponse.json({ error: "bad_players_per_side" }, { status: 400 });
  }
  if (![1, 3, 5, 7].includes(best_of)) {
    return NextResponse.json({ error: "bad_best_of" }, { status: 400 });
  }
  const fee = Number(entry_fee_ton);
  if (!Number.isFinite(fee) || fee <= 0) {
    return NextResponse.json({ error: "bad_entry_fee" }, { status: 400 });
  }

  // Resolve the caller's team for this game.
  const { data: tm, error: tmErr } = await db
    .from("team_members")
    .select("team_id, teams!inner(game_id)")
    .eq("user_id", user.id)
    .eq("teams.game_id", game_id)
    .maybeSingle();
  if (tmErr) return NextResponse.json({ error: tmErr.message }, { status: 400 });
  if (!tm) return NextResponse.json({ error: "no_team_in_game" }, { status: 400 });

  const { data, error } = await db.rpc("enqueue_team", {
    p_team_id: (tm as { team_id: string }).team_id,
    p_user_id: user.id,
    p_rules_id: rules_id,
    p_players_per_side: players_per_side,
    p_best_of: best_of,
    p_entry_fee_ton: fee.toString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ entry: data });
});
