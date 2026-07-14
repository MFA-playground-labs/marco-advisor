import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { setSelectedTripCookie } from "@/lib/server/trip-selection";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: Params) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const repo = createSupabaseRepository(supabase);

  try {
    const user = await repo.requireUser("selecting trips");
    const { id } = await params;
    const trip = await repo.getTripForOwner(user.id, id);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const response = NextResponse.json({ trip });
    setSelectedTripCookie(response, trip.id);
    return response;
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Trip selection failed.") }, { status: errorStatus(error) });
  }
}
