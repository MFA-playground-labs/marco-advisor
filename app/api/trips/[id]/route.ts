import { NextResponse } from "next/server";
import { normalizeTripMetadataInput } from "@/lib/domain/trip";
import { createSupabaseServerClient } from "@/lib/supabase";
import { WorkflowError, errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { logTripLifecycleEvent } from "@/lib/server/trip-observability";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const repo = createSupabaseRepository(supabase);

  try {
    const user = await repo.requireUser("updating trips");
    const { id } = await params;
    const body = await request.json();
    const trip = await repo.updateOwnedTrip(user.id, id, requireTripMetadata(body));
    logTripLifecycleEvent({
      event: "marco.trip_updated",
      userId: user.id,
      tripId: trip.id,
      status: "succeeded"
    });
    return NextResponse.json({ trip });
  } catch (error) {
    logTripLifecycleEvent({
      event: "marco.trip_update_failed",
      status: "failed",
      errorMessage: errorMessage(error, "Trip update failed.")
    });
    return NextResponse.json({ error: errorMessage(error, "Trip update failed.") }, { status: errorStatus(error) });
  }
}

function requireTripMetadata(body: any) {
  const { input, error } = normalizeTripMetadataInput(body);
  if (error || !input) throw new WorkflowError(error ?? "Invalid trip metadata.", 400);
  return input;
}
