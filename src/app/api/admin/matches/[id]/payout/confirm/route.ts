import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

// Step 2 of the secure-payout flow: record the broadcast tx hash. The RPC
// enforces that the same admin who claimed it via prepare is the one
// confirming, so a second admin can't race in with a fabricated hash.
export const POST = withAdmin<{ params: { id: string } }>(async (req: NextRequest, user, { params }) => {
  const { tx_hash } = await req.json();
  if (typeof tx_hash !== "string" || tx_hash.length < 10) {
    return NextResponse.json({ error: "bad_tx_hash" }, { status: 400 });
  }

  const { data, error } = await db.rpc("confirm_match_payout", {
    p_match_id: params.id,
    p_signer_user_id: user.id,
    p_tx_hash: tx_hash,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ payout: data });
});
