import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

/**
 * POST /api/queue/[id]/confirm
 *   body: { tx_hash: string }
 *
 * TEMPORARY (testnet): the webapp calls this immediately after TonConnect
 * returns a successful sendTransaction so the entry flips to `queued` and the
 * matcher runs without waiting for the bot's on-chain sweeper.
 *
 * In production, ONLY the bot should mark entries paid (after observing the
 * payment on-chain). Remove or admin-gate this endpoint before mainnet.
 */
export const POST = withAuth(
  async (req: NextRequest, _user, { params }: { params: { id: string } }) => {
    const { tx_hash } = await req.json();
    if (typeof tx_hash !== "string" || tx_hash.length < 4) {
      return NextResponse.json({ error: "bad_tx_hash" }, { status: 400 });
    }
    const { data, error } = await db.rpc("mark_queue_entry_paid", {
      p_entry_id: params.id,
      p_tx_hash: tx_hash,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ match_id: data });
  },
);
