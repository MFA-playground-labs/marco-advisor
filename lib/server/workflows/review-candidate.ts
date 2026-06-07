import {
  bookingInsertFromCandidate,
  bookingSegmentInsertFromCandidate
} from "@/lib/domain/booking-mapping";
import { WorkflowError } from "@/lib/server/errors";
import type { SupabaseRepository } from "@/lib/server/supabase-repository";

export type CandidateReviewIntent = "accept" | "reject";

export async function reviewCandidate(
  repo: Pick<
    SupabaseRepository,
    "requireUser" | "getCandidate" | "markCandidateStatus" | "createBooking" | "createBookingSegment"
  >,
  id: string,
  intent: string
) {
  await repo.requireUser("reviewing candidates");

  if (intent === "reject") {
    await repo.markCandidateStatus(id, "rejected");
    return { status: "rejected" as const };
  }

  if (intent !== "accept") {
    throw new WorkflowError("Unsupported candidate action.", 400);
  }

  const candidate = await repo.getCandidate(id);
  const booking = await repo.createBooking(bookingInsertFromCandidate(candidate));
  await repo.createBookingSegment(bookingSegmentInsertFromCandidate(candidate, booking.id));
  await repo.markCandidateStatus(id, "accepted");

  return { status: "accepted" as const, booking };
}
