import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

/**
 * POST /api/queue/[id]/cancel
 * Cancels a queue entry. Allowed only while pending_payment or queued; once
 * matched the search is locked.
 */
export const POST = withAuth(
  async (_req: NextRequest, user, { params }: { params: { id: string } }) => {
    const { data, error } = await db.rpc("cancel_queue_entry", {
      p_entry_id: params.id,
      p_user_id: user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) {
      return NextResponse.json({ error: "cancel_not_allowed" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  },
);
