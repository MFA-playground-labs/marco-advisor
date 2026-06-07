import { NextResponse } from "next/server";
import { getActiveTripSnapshot } from "@/lib/data";
import { askMarco } from "@/lib/openai-extract";
import { createSupabaseServerClient } from "@/lib/supabase";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  try {
    await createSupabaseRepository(supabase).requireUser("asking Marco");
    const body = await request.json();
    const question = String(body.question ?? "").trim();
    if (!question) return NextResponse.json({ error: "Question is required." }, { status: 400 });

    const snapshot = await getActiveTripSnapshot();
    const answer = await askMarco({ question, context: snapshot });
    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Marco request failed.") }, { status: errorStatus(error) });
  }
}
