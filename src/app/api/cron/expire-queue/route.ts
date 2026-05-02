import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/supabase";

// Cron entry — see vercel.json. Vercel sends `Authorization: Bearer
// <CRON_SECRET>` for crons configured with a secret. Anyone hitting this
// route without the secret is rejected so it's safe to leave undefended in
// the public route table.

const MAX_AGE_MINUTES = 10;

export const GET = handle;
export const POST = handle;

async function handle(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = req.headers.get("authorization") ?? "";
    if (got !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const { data, error } = await db.rpc("expire_stale_queue_entries", {
    p_max_age_minutes: MAX_AGE_MINUTES,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expired: data ?? 0 });
}
