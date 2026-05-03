import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

// Read-only payout status for a match. Anyone authenticated can call it —
// the result is non-sensitive (status + amount + tx hash, all derivable
// on-chain anyway). Used by the match page to render the "paid / pending /
// not yet" pill.
export const GET = withAuth<{ params: { id: string } }>(async (_req, _user, { params }) => {
  const { data, error } = await db
    .from("transactions")
    .select("id, user_id, amount_ton, status, tx_hash, created_at, signed_at")
    .eq("match_id", params.id)
    .eq("type", "payout")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ payout: data ?? null });
});
