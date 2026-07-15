import type { User } from "@supabase/supabase-js";
import type { SupabaseRepository } from "@/lib/server/supabase-repository";
import type { Trip } from "@/lib/types";

export type ActiveTripResolution = {
  trip: Trip | null;
  hasPrivateTrips: boolean;
  selectedTripId: string | null;
  selectedTripInvalid: boolean;
};

type ActiveTripRepo = Pick<SupabaseRepository, "getTripForOwner" | "getActiveTrip" | "listTripsForUser">;

export async function resolveActiveTrip(
  repo: ActiveTripRepo,
  user: User,
  selectedTripId: string | null
): Promise<ActiveTripResolution> {
  if (selectedTripId) {
    const selectedTrip = await repo.getTripForOwner(user.id, selectedTripId);
    if (selectedTrip) {
      return {
        trip: selectedTrip,
        hasPrivateTrips: true,
        selectedTripId: selectedTrip.id,
        selectedTripInvalid: false
      };
    }
  }

  const activeTrip = await repo.getActiveTrip(user.id);
  if (activeTrip) {
    return {
      trip: activeTrip,
      hasPrivateTrips: true,
      selectedTripId: activeTrip.id,
      selectedTripInvalid: Boolean(selectedTripId)
    };
  }

  const trips = await repo.listTripsForUser(user.id);
  return {
    trip: null,
    hasPrivateTrips: trips.length > 0,
    selectedTripId: null,
    selectedTripInvalid: Boolean(selectedTripId)
  };
}
