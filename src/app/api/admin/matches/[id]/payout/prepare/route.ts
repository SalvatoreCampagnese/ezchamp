import { NextResponse } from "next/server";
import { Address } from "@ton/core";
import { withAdmin } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

// Server-side gate #1 of the secure-payout flow.
//
// We only release the recipient/amount payload to admins whose persisted
// wallet matches the configured escrow. Without this, a compromised admin
// account could trigger prepare and surface a recipient address — though
// the *funds* would never move (only the escrow's keyholder can sign
// outgoing transfers), an attacker could grief the audit log by claiming
// payouts they can't actually send.
//
// The escrow is read from the server-only env first, falling back to the
// public manifest. If neither is set, the route refuses (escrow_unset).

const ESCROW = process.env.TON_ESCROW_ADDRESS ?? process.env.NEXT_PUBLIC_TON_ESCROW_ADDRESS ?? "";

function addressesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    return Address.parse(a).equals(Address.parse(b));
  } catch {
    return false;
  }
}

export const POST = withAdmin<{ params: { id: string } }>(async (_req, user, { params }) => {
  if (!ESCROW) {
    return NextResponse.json({ error: "escrow_unset" }, { status: 500 });
  }
  if (!addressesEqual(user.wallet_address, ESCROW)) {
    return NextResponse.json({ error: "admin_wallet_is_not_escrow" }, { status: 403 });
  }

  const { data, error } = await db.rpc("prepare_match_payout", {
    p_match_id: params.id,
    p_signer_user_id: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // RPC returns SETOF — Supabase wraps it in an array. We want a single row.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: "no_row" }, { status: 500 });

  return NextResponse.json({ prepared: row });
});
