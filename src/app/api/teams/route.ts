import { NextResponse, type NextRequest } from "next/server";
import { customAlphabet } from "@/lib/nanoid";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

const inviteCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

// GET /api/teams?game_id=...  → my team for that game
export const GET = withAuth(async (req, user) => {
  const url = new URL(req.url);
  const gameId = url.searchParams.get("game_id") ?? user.current_game_id;
  if (!gameId) return NextResponse.json({ team: null, members: [] });

  const { data: tm, error: tmErr } = await db
    .from("team_members")
    .select("teams(*)")
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .maybeSingle();
  if (tmErr) return NextResponse.json({ error: tmErr.message }, { status: 400 });
  const team = (tm as { teams: { id: string } } | null)?.teams ?? null;
  if (!team) return NextResponse.json({ team: null, members: [] });

  const { data: members, error: mErr } = await db
    .from("team_members")
    .select("*, user:users(id, telegram_id, telegram_username)")
    .eq("team_id", team.id);
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });
  return NextResponse.json({ team, members: members ?? [] });
});

// POST /api/teams { name, game_id } → create
export const POST = withAuth(async (req: NextRequest, user) => {
  const { name, game_id } = await req.json();
  if (typeof name !== "string" || name.length < 3 || name.length > 32) {
    return NextResponse.json({ error: "bad_name" }, { status: 400 });
  }
  if (typeof game_id !== "string") return NextResponse.json({ error: "bad_game" }, { status: 400 });

  const { data: team, error: teamErr } = await db
    .from("teams")
    .insert({ name, game_id, owner_user_id: user.id, invite_code: inviteCode() })
    .select("*")
    .single();
  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 400 });

  const { error: memberErr } = await db.from("team_members").insert({
    team_id: (team as { id: string }).id,
    user_id: user.id,
    game_id,
    role: "owner",
  });
  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 400 });

  return NextResponse.json({ team });
});
