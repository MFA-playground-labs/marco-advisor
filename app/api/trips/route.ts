import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const repo = createSupabaseRepository(supabase);

  try {
    const user = await repo.requireUser("creating trips");
    const body = await request.json();
    const trip = await repo.createTrip({
      owner_id: user.id,
      name: body.name ?? "Trip from upload",
      destination: body.destination ?? null,
      starts_on: body.starts_on ?? null,
      ends_on: body.ends_on ?? null
    });
    return NextResponse.json({ trip });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Trip creation failed.") }, { status: errorStatus(error) });
  }
}
