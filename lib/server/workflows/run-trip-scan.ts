import { scanTrip } from "@/lib/domain/scanner";
import { WorkflowError } from "@/lib/server/errors";
import type { SupabaseRepository } from "@/lib/server/supabase-repository";

export async function runTripScan(
  repo: Pick<SupabaseRepository, "requireUser" | "getActiveTrip" | "getBookingsForTrip" | "replaceTripIssues">
) {
  const user = await repo.requireUser("scanning trips");
  const trip = await repo.getActiveTrip(user.id);
  if (!trip) throw new WorkflowError("No active trip.", 404);

  const bookings = await repo.getBookingsForTrip(trip.id);
  const issues = scanTrip(trip, bookings);
  await repo.replaceTripIssues(trip.id, issues);

  return { issues: issues.length };
}
