import { NextResponse } from "next/server";
import { normalizeTripMetadataInput } from "@/lib/domain/trip";
import { createSupabaseServerClient } from "@/lib/supabase";
import { WorkflowError, errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { logTripLifecycleEvent } from "@/lib/server/trip-observability";
import { setSelectedTripCookie } from "@/lib/server/trip-selection";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const repo = createSupabaseRepository(supabase);

  try {
    const user = await repo.requireUser("listing trips");
    const trips = await repo.listTripsForUser(user.id);
    const active = trips.filter((trip) => !trip.archived_at);
    const archived = trips.filter((trip) => trip.archived_at);
    return NextResponse.json({
      active,
      archived,
      past: active.filter((trip) => isPastTrip(trip.ends_on))
    });
  } catch (error) {
    logTripLifecycleEvent({
      event: "marco.trip_list_failed",
      status: "failed",
      errorMessage: errorMessage(error, "Trip listing failed.")
    });
    return NextResponse.json({ error: errorMessage(error, "Trip listing failed.") }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const repo = createSupabaseRepository(supabase);

  try {
    const user = await repo.requireUser("creating trips");
    const body = await request.json();
    const input = requireTripMetadata(body);
    const trip = await repo.createTrip({
      owner_id: user.id,
      name: input.name,
      destination: input.destination,
      starts_on: input.starts_on,
      ends_on: input.ends_on
    });
    logTripLifecycleEvent({
      event: "marco.trip_created",
      userId: user.id,
      tripId: trip.id,
      status: "succeeded"
    });
    const response = NextResponse.json({ trip });
    setSelectedTripCookie(response, trip.id);
    return response;
  } catch (error) {
    logTripLifecycleEvent({
      event: "marco.trip_create_failed",
      status: "failed",
      errorMessage: errorMessage(error, "Trip creation failed.")
    });
    return NextResponse.json({ error: errorMessage(error, "Trip creation failed.") }, { status: errorStatus(error) });
  }
}

function requireTripMetadata(body: any) {
  const { input, error } = normalizeTripMetadataInput(body);
  if (error || !input) throw new WorkflowError(error ?? "Invalid trip metadata.", 400);
  return input;
}

function isPastTrip(endsOn: string | null) {
  if (!endsOn) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(`${endsOn}T00:00:00.000Z`) < today;
}
