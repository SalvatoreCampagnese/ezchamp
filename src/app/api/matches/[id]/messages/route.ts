import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

// Player-facing dispute chat. The route is keyed by match_id so the client
// doesn't need to know the dispute_id. The server resolves the active
// (non-resolved) dispute for that match, derives which side the caller's
// team sits on, and gates reads/writes to that side only.

interface MatchRow {
  id: string;
  game_id: string;
  status: string;
  poster_team_id: string;
  accepter_team_id: string | null;
}

async function resolveContext(matchId: string, userId: string) {
  const { data: match } = await db
    .from("matches")
    .select("id, game_id, status, poster_team_id, accepter_team_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { error: "match_not_found" as const, status: 404 };
  const m = match as MatchRow;

  const { data: tm } = await db
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .eq("game_id", m.game_id)
    .maybeSingle();
  const teamId = (tm as { team_id: string } | null)?.team_id ?? null;
  if (!teamId || ![m.poster_team_id, m.accepter_team_id].includes(teamId)) {
    return { error: "not_in_match" as const, status: 403 };
  }

  const side: "poster" | "accepter" =
    teamId === m.poster_team_id ? "poster" : "accepter";

  const { data: dispute } = await db
    .from("disputes")
    .select("id, status")
    .eq("match_id", m.id)
    .in("status", ["open", "investigating"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!dispute) return { error: "no_active_dispute" as const, status: 404 };

  return { match: m, side, disputeId: (dispute as { id: string }).id };
}

export const GET = withAuth<{ params: { id: string } }>(async (_req, user, { params }) => {
  const ctx = await resolveContext(params.id, user.id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data, error } = await db
    .from("dispute_messages")
    .select("id, sender_is_staff, body, created_at")
    .eq("dispute_id", ctx.disputeId)
    .eq("team_side", ctx.side)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    messages: data ?? [],
    dispute_id: ctx.disputeId,
    team_side: ctx.side,
  });
});

export const POST = withAuth<{ params: { id: string } }>(async (req: NextRequest, user, { params }) => {
  const { body } = await req.json();
  if (typeof body !== "string" || body.trim().length === 0 || body.length > 2000) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const ctx = await resolveContext(params.id, user.id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data, error } = await db
    .from("dispute_messages")
    .insert({
      dispute_id: ctx.disputeId,
      match_id: ctx.match.id,
      team_side: ctx.side,
      sender_user_id: user.id,
      sender_is_staff: false,
      body: body.trim(),
    })
    .select("id, sender_is_staff, body, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: data });
});
