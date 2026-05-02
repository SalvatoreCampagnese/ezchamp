import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

/**
 * GET /api/queue/me
 * Returns the caller's currently-active queue entry (pending_payment, queued,
 * or matched-with-still-active-match), if any.
 *
 * A `matched` entry whose linked match has since been disputed, completed,
 * or cancelled is treated as no longer active — the user should be free to
 * queue again, and the home page shouldn't surface a stale "MATCHED!" banner
 * pointing at a dispute.
 */
export const GET = withAuth(async (_req, user) => {
  // Best-effort lazy sweep: the hourly Vercel cron is the authoritative
  // worker, but firing the RPC on each /api/queue/me read means the user's
  // own banner clears (and their refund is queued) within seconds of the
  // 10-minute window passing instead of up to an hour later. Errors here
  // are swallowed — the cron will retry.
  await db.rpc("expire_stale_queue_entries", { p_max_age_minutes: 10 });

  const { data, error } = await db
    .from("queue_entries")
    .select("*, rule:rules(id,name), game:games(id,slug,name), match:matches(id,status)")
    .eq("user_id", user.id)
    .in("status", ["pending_payment", "queued", "matched"])
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []) as Array<{
    status: string;
    match: { status: string } | null;
  } & Record<string, unknown>>;

  const active = rows.find((row) => {
    if (row.status !== "matched") return true;
    const ms = row.match?.status;
    return ms === "accepted" || ms === "awaiting_result";
  });
  return NextResponse.json({ entry: active ?? null });
});
