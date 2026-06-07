import { NextResponse } from "next/server";
import { getActiveTripSnapshot } from "@/lib/data";
import { askMarco } from "@/lib/openai-extract";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Anonymous Supabase auth must be enabled before asking Marco." }, { status: 401 });

  const body = await request.json();
  const question = String(body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "Question is required." }, { status: 400 });

  const snapshot = await getActiveTripSnapshot();
  const answer = await askMarco({ question, context: snapshot });
  return NextResponse.json({ answer });
}
