import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { getSelectedTripId } from "@/lib/server/trip-selection";
import { runTripScan } from "@/lib/server/workflows/run-trip-scan";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  try {
    return NextResponse.json(await runTripScan(createSupabaseRepository(supabase), await getSelectedTripId()));
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Scanner failed.") }, { status: errorStatus(error) });
  }
}
