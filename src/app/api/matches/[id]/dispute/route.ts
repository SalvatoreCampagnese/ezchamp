import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

export const POST = withAuth<{ params: { id: string } }>(async (req: NextRequest, user, { params }) => {
  const { description } = await req.json();
  const { data: match } = await db
    .from("matches")
    .select("id, game_id, status, poster_team_id, accepter_team_id, poster_user_id, accepter_user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const m = match as {
    id: string; game_id: string; status: string;
    poster_team_id: string; accepter_team_id: string | null;
  };
  const { data: tm } = await db
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .eq("game_id", m.game_id)
    .maybeSingle();
  if (!tm) return NextResponse.json({ error: "not_in_match" }, { status: 403 });
  const teamId = (tm as { team_id: string }).team_id;
  if (![m.poster_team_id, m.accepter_team_id].includes(teamId)) {
    return NextResponse.json({ error: "not_in_match" }, { status: 403 });
  }

  const reason = m.status === "disputed" ? "result_mismatch" : "mid_game";
  const { data: dispute, error } = await db.rpc("open_dispute", {
    p_match_id: m.id,
    p_user_id: user.id,
    p_team_id: teamId,
    p_reason: reason,
    p_description: typeof description === "string" ? description : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ dispute });
});
