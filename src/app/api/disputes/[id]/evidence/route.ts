import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/supabase";

// GET evidence list, POST a new URL piece. File upload to Supabase Storage is
// a follow-up (see WHAT_TO_DO.md §2.2).

export const GET = withAuth<{ params: { id: string } }>(async (_req, _user, { params }) => {
  const { data, error } = await db
    .from("dispute_evidence")
    .select("*")
    .eq("dispute_id", params.id)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ evidence: data ?? [] });
});

export const POST = withAuth<{ params: { id: string } }>(async (req: NextRequest, user, { params }) => {
  const { url, description } = await req.json();
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "bad_url" }, { status: 400 });
  }
  const { data, error } = await db
    .from("dispute_evidence")
    .insert({
      dispute_id: params.id,
      submitter_user_id: user.id,
      url,
      description: typeof description === "string" ? description : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ evidence: data });
});
