import type { TablesInsert } from "@/lib/database.types";
import type { ExtractedBookingCandidate } from "@/lib/types";

export function bookingInsertFromCandidate(candidate: ExtractedBookingCandidate): TablesInsert<"bookings"> {
  if (!candidate.trip_id) {
    throw new Error("Candidate is missing a trip.");
  }

  return {
    trip_id: candidate.trip_id,
    type: candidate.booking_type,
    status: "confirmed",
    vendor: candidate.vendor ?? candidate.title,
    title: candidate.title,
    location: candidate.location,
    confirmation_code: candidate.confirmation_code,
    starts_at: candidate.starts_at,
    ends_at: candidate.ends_at,
    total_amount: candidate.total_amount,
    currency: candidate.currency,
    refundable: candidate.refundable,
    cancellation_deadline: candidate.cancellation_deadline,
    traveler_names: candidate.traveler_names,
    source_upload_id: candidate.upload_id,
    confidence: candidate.confidence,
    missing_fields: candidate.missing_fields,
    notes: null
  };
}

export function bookingSegmentInsertFromCandidate(
  candidate: ExtractedBookingCandidate,
  bookingId: string
): TablesInsert<"booking_segments"> {
  if (!candidate.trip_id) {
    throw new Error("Candidate is missing a trip.");
  }

  return {
    booking_id: bookingId,
    trip_id: candidate.trip_id,
    type: candidate.booking_type,
    label: candidate.title,
    starts_at: candidate.starts_at,
    ends_at: candidate.ends_at,
    origin: null,
    destination: null,
    location: candidate.location
  };
}
