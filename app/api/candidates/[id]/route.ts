import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { reviewCandidate } from "@/lib/server/workflows/review-candidate";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    await reviewCandidate(createSupabaseRepository(supabase), id, intent);
    return NextResponse.redirect(new URL("/bookings", request.url), { status: 303 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Candidate review failed.") }, { status: errorStatus(error) });
  }
}
