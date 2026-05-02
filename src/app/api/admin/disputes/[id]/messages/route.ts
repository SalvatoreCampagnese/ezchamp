import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

// Staff messages endpoint. Unlike the player endpoint, side is taken from
// the query/body — staff can read and write to either thread.

function readSide(value: unknown): "poster" | "accepter" | null {
  return value === "poster" || value === "accepter" ? value : null;
}

export const GET = withAdmin<{ params: { id: string } }>(async (req: NextRequest, _user, { params }) => {
  const side = readSide(new URL(req.url).searchParams.get("side"));
  if (!side) return NextResponse.json({ error: "bad_side" }, { status: 400 });

  const { data, error } = await db
    .from("dispute_messages")
    .select("id, sender_is_staff, body, created_at")
    .eq("dispute_id", params.id)
    .eq("team_side", side)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ messages: data ?? [] });
});

export const POST = withAdmin<{ params: { id: string } }>(async (req: NextRequest, user, { params }) => {
  const { side: rawSide, body } = await req.json();
  const side = readSide(rawSide);
  if (!side) return NextResponse.json({ error: "bad_side" }, { status: 400 });
  if (typeof body !== "string" || body.trim().length === 0 || body.length > 2000) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const { data: dispute } = await db
    .from("disputes")
    .select("id, match_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!dispute) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error } = await db
    .from("dispute_messages")
    .insert({
      dispute_id: params.id,
      match_id: (dispute as { match_id: string }).match_id,
      team_side: side,
      sender_user_id: user.id,
      sender_is_staff: true,
      body: body.trim(),
    })
    .select("id, sender_is_staff, body, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: data });
});
