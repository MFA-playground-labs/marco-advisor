import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { clearSelectedTripCookie, getSelectedTripId } from "@/lib/server/trip-selection";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: Params) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const repo = createSupabaseRepository(supabase);

  try {
    const user = await repo.requireUser("archiving trips");
    const { id } = await params;
    const trip = await repo.archiveTrip(user.id, id);
    const response = NextResponse.json({ trip });
    if ((await getSelectedTripId()) === id) {
      clearSelectedTripCookie(response);
    }
    return response;
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Trip archive failed.") }, { status: errorStatus(error) });
  }
}
