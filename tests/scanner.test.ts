import { describe, expect, it } from "vitest";
import { calculateFinancialExposure, calculateReadiness, scanTrip } from "@/lib/scanner";
import type { Booking, Trip } from "@/lib/types";

const trip: Trip = {
  id: "11111111-1111-1111-1111-111111111111",
  owner_id: "22222222-2222-2222-2222-222222222222",
  name: "Upload Trip",
  destination: "Paris",
  starts_on: "2026-06-18",
  ends_on: "2026-06-22"
};

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: crypto.randomUUID(),
    trip_id: trip.id,
    type: "hotel",
    status: "confirmed",
    vendor: "Vendor",
    title: "Booking",
    location: "Paris",
    confirmation_code: null,
    starts_at: null,
    ends_at: null,
    total_amount: null,
    currency: "EUR",
    refundable: true,
    cancellation_deadline: null,
    traveler_names: [],
    source_upload_id: null,
    confidence: 1,
    missing_fields: [],
    notes: null,
    ...overrides
  };
}

describe("scanTrip", () => {
  it("detects overlapping hotel bookings and gap nights", () => {
    const bookings = [
      booking({
        id: "33333333-3333-3333-3333-333333333333",
        title: "Hotel A",
        starts_at: "2026-06-19T00:00:00.000Z",
        ends_at: "2026-06-21T00:00:00.000Z",
        total_amount: 600,
        refundable: false
      }),
      booking({
        id: "44444444-4444-4444-4444-444444444444",
        title: "Hotel B",
        starts_at: "2026-06-20T00:00:00.000Z",
        ends_at: "2026-06-22T00:00:00.000Z",
        total_amount: 900
      })
    ];

    const issues = scanTrip(trip, bookings);
    expect(issues.some((issue) => issue.category === "double_booking")).toBe(true);
    expect(issues.some((issue) => issue.category === "itinerary_gap" && issue.starts_at === "2026-06-18")).toBe(true);
  });

  it("calculates exposure and readiness from scanner output", () => {
    const bookings = [
      booking({ total_amount: 600, refundable: false }),
      booking({ total_amount: 900, refundable: true })
    ];
    const issues = [
      {
        id: "issue",
        trip_id: trip.id,
        severity: "high" as const,
        status: "unresolved" as const,
        category: "double_booking",
        title: "Overlap",
        summary: "Overlap",
        starts_at: null,
        ends_at: null,
        financial_impact: 1500,
        currency: "EUR",
        related_booking_ids: [],
        recommended_action: null
      }
    ];

    expect(calculateFinancialExposure(bookings, issues).cleanEstimate).toBe(0);
    expect(calculateReadiness(issues).score).toBe(75);
  });
});
