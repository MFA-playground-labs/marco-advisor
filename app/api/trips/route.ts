import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { WorkflowError, errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
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
    const input = tripInput(body);
    const trip = await repo.createTrip({
      owner_id: user.id,
      name: input.name,
      destination: input.destination,
      starts_on: input.starts_on,
      ends_on: input.ends_on
    });
    const response = NextResponse.json({ trip });
    setSelectedTripCookie(response, trip.id);
    return response;
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Trip creation failed.") }, { status: errorStatus(error) });
  }
}

function tripInput(body: any) {
  const name = String(body?.name ?? "").trim();
  if (!name) {
    throw new WorkflowError("Trip name is required.", 400);
  }

  return {
    name,
    destination: nullableString(body?.destination),
    starts_on: nullableString(body?.starts_on),
    ends_on: nullableString(body?.ends_on)
  };
}

function nullableString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function isPastTrip(endsOn: string | null) {
  if (!endsOn) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(`${endsOn}T00:00:00.000Z`) < today;
}
