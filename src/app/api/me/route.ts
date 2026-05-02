import { NextResponse, type NextRequest } from "next/server";
import { isAdmin, withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

export const GET = withAuth(async (_req, user) => {
  return NextResponse.json({ user: { ...user, is_admin: isAdmin(user.telegram_id) } });
});

export const PATCH = withAuth(async (req: NextRequest, user) => {
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.wallet_address === "string") {
    updates.wallet_address = body.wallet_address;
    updates.wallet_linked_at = new Date().toISOString();
  } else if (body.wallet_address === null) {
    updates.wallet_address = null;
    updates.wallet_linked_at = null;
  }
  if (typeof body.current_game_id === "string" || body.current_game_id === null) {
    updates.current_game_id = body.current_game_id;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }
  const { data, error } = await db
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select("id, telegram_id, telegram_username, wallet_address, current_game_id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data });
});
