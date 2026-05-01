import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

/**
 * GET /api/queue/me
 * Returns the caller's currently-active queue entry (pending_payment, queued,
 * or matched), if any. Used by the home page to surface a "Searching…" banner.
 */
export const GET = withAuth(async (_req, user) => {
  const { data, error } = await db
    .from("queue_entries")
    .select("*, rule:rules(id,name), game:games(id,slug,name)")
    .eq("user_id", user.id)
    .in("status", ["pending_payment", "queued", "matched"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ entry: data });
});
