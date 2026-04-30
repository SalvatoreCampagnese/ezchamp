import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

/**
 * POST /api/matches/[id]/accept { tx_boc?: string }
 *
 * The Mini App calls this after `tonConnectUI.sendTransaction()` returns. We
 * record an intent-to-accept; the on-chain payment sweeper then flips the row
 * to `accepted` once it actually sees the funds. We don't trust the BOC the
 * wallet returns blindly — we only use it as a hint for logging.
 */
export const POST = withAuth<{ params: { id: string } }>(async (req: NextRequest, user, { params }) => {
  const matchId = params.id;
  const { tx_boc } = await req.json().catch(() => ({}));

  // Look up the match and the user's team in that game.
  const { data: match, error: mErr } = await db
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const m = match as { id: string; game_id: string; status: string; poster_team_id: string; poster_paid_tx_hash: string | null };
  if (m.status !== "open" || !m.poster_paid_tx_hash) {
    return NextResponse.json({ error: "match_unavailable" }, { status: 409 });
  }

  const { data: tm } = await db
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .eq("game_id", m.game_id)
    .maybeSingle();
  if (!tm) return NextResponse.json({ error: "no_team_in_game" }, { status: 400 });
  const teamId = (tm as { team_id: string }).team_id;
  if (teamId === m.poster_team_id) {
    return NextResponse.json({ error: "cannot_accept_own_match" }, { status: 400 });
  }

  // Note: we do NOT call accept_match here — the bot's payment sweeper does it
  // once funds arrive on chain. This endpoint just acknowledges the user's
  // intent and returns the memo + amount to the client for display.
  return NextResponse.json({
    ok: true,
    memo: `EZC:${matchId}`,
    escrow: process.env.NEXT_PUBLIC_TON_ESCROW_ADDRESS,
    amount_ton: (match as { stake_ton: string }).stake_ton,
    tx_boc: tx_boc ?? null,
  });
});
