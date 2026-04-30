import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

export const POST = withAuth(async (req: NextRequest, user) => {
  const { code } = await req.json();
  if (typeof code !== "string") return NextResponse.json({ error: "bad_code" }, { status: 400 });

  const { data: team, error: teamErr } = await db
    .from("teams")
    .select("*")
    .eq("invite_code", code.trim().toUpperCase())
    .maybeSingle();
  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 400 });
  if (!team) return NextResponse.json({ error: "invalid_code" }, { status: 404 });

  const t = team as { id: string; game_id: string };
  const { error: memberErr } = await db.from("team_members").insert({
    team_id: t.id,
    user_id: user.id,
    game_id: t.game_id,
    role: "member",
  });
  if (memberErr) {
    const code = (memberErr as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json({ error: "already_in_team_for_game" }, { status: 409 });
    }
    return NextResponse.json({ error: memberErr.message }, { status: 400 });
  }
  return NextResponse.json({ team });
});
