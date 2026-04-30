import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

export const POST = withAuth<{ params: { id: string } }>(async (req: NextRequest, user, { params }) => {
  const { winner_team_id } = await req.json();
  if (typeof winner_team_id !== "string") {
    return NextResponse.json({ error: "missing_winner" }, { status: 400 });
  }

  const { data: match } = await db.from("matches").select("game_id").eq("id", params.id).maybeSingle();
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: tm } = await db
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .eq("game_id", (match as { game_id: string }).game_id)
    .maybeSingle();
  if (!tm) return NextResponse.json({ error: "not_in_match" }, { status: 403 });

  const { data, error } = await db.rpc("report_result", {
    p_match_id: params.id,
    p_team_id: (tm as { team_id: string }).team_id,
    p_user_id: user.id,
    p_winner_team_id: winner_team_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const row = (data as Array<{ new_status: string; winner_team_id: string | null }> | null)?.[0];
  return NextResponse.json({ result: row });
});
