import { differenceInCalendarDays, isAfter, isBefore, parseISO } from "date-fns";
import type { Booking, FinancialExposure, IssueSeverity, Readiness, Trip, TripIssue } from "@/lib/types";

const now = () => new Date();

function dateOrNull(value: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function bookingRange(booking: Booking) {
  const start = dateOrNull(booking.starts_at);
  const end = dateOrNull(booking.ends_at);
  if (!start || !end) return null;
  return { start, end };
}

function rangesOverlap(a: Booking, b: Booking) {
  const ar = bookingRange(a);
  const br = bookingRange(b);
  if (!ar || !br) return false;
  return isBefore(ar.start, br.end) && isAfter(ar.end, br.start);
}

function issueId(category: string, bookingIds: string[]) {
  return `${category}:${bookingIds.sort().join(":")}`;
}

function severityRank(severity: IssueSeverity) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[severity];
}

export function scanTrip(trip: Trip | null, bookings: Booking[]): TripIssue[] {
  const confirmed = bookings.filter((booking) => booking.status === "confirmed");
  const issues: TripIssue[] = [];

  const hotels = confirmed.filter((booking) => booking.type === "hotel");
  hotels.forEach((booking, index) => {
    hotels.slice(index + 1).forEach((other) => {
      if (!rangesOverlap(booking, other)) return;
      const impact = (booking.total_amount ?? 0) + (other.total_amount ?? 0);
      issues.push({
        id: issueId("double_booking", [booking.id, other.id]),
        trip_id: booking.trip_id,
        severity: "high",
        status: "unresolved",
        category: "double_booking",
        title: `${booking.title} overlaps ${other.title}`,
        summary: "Two hotel bookings overlap. Review which stay should remain active.",
        starts_at: booking.starts_at,
        ends_at: other.ends_at,
        financial_impact: impact || null,
        currency: booking.currency ?? other.currency,
        related_booking_ids: [booking.id, other.id],
        recommended_action: "Compare cancellation deadlines and keep the intended hotel only."
      });
    });
  });

  confirmed.forEach((booking) => {
    if (booking.missing_fields.length > 0) {
      issues.push({
        id: issueId("missing_details", [booking.id]),
        trip_id: booking.trip_id,
        severity: booking.missing_fields.includes("starts_at") || booking.missing_fields.includes("ends_at") ? "high" : "medium",
        status: "unresolved",
        category: "missing_details",
        title: `${booking.title} needs detail review`,
        summary: `Missing ${booking.missing_fields.join(", ")}.`,
        starts_at: booking.starts_at,
        ends_at: booking.ends_at,
        financial_impact: null,
        currency: booking.currency,
        related_booking_ids: [booking.id],
        recommended_action: "Open the source document and complete the missing booking fields."
      });
    }

    const deadline = dateOrNull(booking.cancellation_deadline);
    if (deadline && isAfter(deadline, now())) {
      const daysLeft = differenceInCalendarDays(deadline, now());
      if (daysLeft <= 10) {
        issues.push({
          id: issueId("cancellation_deadline", [booking.id]),
          trip_id: booking.trip_id,
          severity: daysLeft <= 4 ? "high" : "medium",
          status: "unresolved",
          category: "cancellation_deadline",
          title: `${booking.title} cancellation deadline in ${daysLeft} days`,
          summary: "A cancellation or refund deadline is approaching.",
          starts_at: booking.cancellation_deadline,
          ends_at: booking.cancellation_deadline,
          financial_impact: booking.total_amount,
          currency: booking.currency,
          related_booking_ids: [booking.id],
          recommended_action: "Decide whether to keep or cancel this booking before the deadline."
        });
      }
    }

    if (trip?.starts_on && booking.starts_at && isBefore(parseISO(booking.starts_at), parseISO(trip.starts_on))) {
      issues.push({
        id: issueId("outside_trip_dates", [booking.id]),
        trip_id: booking.trip_id,
        severity: "medium",
        status: "unresolved",
        category: "outside_trip_dates",
        title: `${booking.title} starts before trip dates`,
        summary: "The booking appears to fall outside the active trip window.",
        starts_at: booking.starts_at,
        ends_at: booking.ends_at,
        financial_impact: booking.total_amount,
        currency: booking.currency,
        related_booking_ids: [booking.id],
        recommended_action: "Confirm the trip dates or move this booking to another trip."
      });
    }
  });

  if (trip?.starts_on && trip.ends_on) {
    const tripStart = parseISO(trip.starts_on);
    const tripEnd = parseISO(trip.ends_on);
    const coveredNights = new Set<string>();
    hotels.forEach((hotel) => {
      const range = bookingRange(hotel);
      if (!range) return;
      let cursor = range.start;
      while (isBefore(cursor, range.end)) {
        coveredNights.add(cursor.toISOString().slice(0, 10));
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
      }
    });
    let cursor = tripStart;
    while (isBefore(cursor, tripEnd)) {
      const date = cursor.toISOString().slice(0, 10);
      if (!coveredNights.has(date)) {
        issues.push({
          id: `gap_night:${trip.id}:${date}`,
          trip_id: trip.id,
          severity: "low",
          status: "unresolved",
          category: "itinerary_gap",
          title: `Unbooked night: ${date}`,
          summary: "No hotel stay covers this trip night.",
          starts_at: date,
          ends_at: date,
          financial_impact: null,
          currency: null,
          related_booking_ids: [],
          recommended_action: "Upload or add the missing lodging reservation."
        });
      }
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  return issues.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

export function calculateFinancialExposure(bookings: Booking[], issues: TripIssue[]): FinancialExposure {
  const confirmed = bookings.filter((booking) => booking.status === "confirmed");
  const currency = confirmed.find((booking) => booking.currency)?.currency ?? "EUR";
  const currentBooked = confirmed.reduce((sum, booking) => sum + (booking.total_amount ?? 0), 0);
  const locked = confirmed
    .filter((booking) => booking.refundable === false)
    .reduce((sum, booking) => sum + (booking.total_amount ?? 0), 0);
  const refundable = confirmed
    .filter((booking) => booking.refundable !== false)
    .reduce((sum, booking) => sum + (booking.total_amount ?? 0), 0);
  const conflicting = issues
    .filter((issue) => issue.category === "double_booking")
    .reduce((sum, issue) => sum + (issue.financial_impact ?? 0), 0);

  return {
    currentBooked,
    locked,
    refundable,
    conflicting,
    missingTbdCount: confirmed.filter((booking) => booking.total_amount === null).length,
    cleanEstimate: Math.max(currentBooked - conflicting, 0),
    currency
  };
}

export function calculateReadiness(issues: TripIssue[]): Readiness {
  const unresolved = issues.filter((issue) => issue.status === "unresolved" || issue.status === "in_progress");
  const criticalCount = unresolved.filter((issue) => issue.severity === "critical").length;
  const highCount = unresolved.filter((issue) => issue.severity === "high").length;
  const mediumCount = unresolved.filter((issue) => issue.severity === "medium").length;
  const lowCount = unresolved.filter((issue) => issue.severity === "low").length;
  const penalty = criticalCount * 35 + highCount * 25 + mediumCount * 12 + lowCount * 5;
  const score = Math.max(0, 100 - penalty);
  return {
    score,
    label: score >= 90 ? "Ready" : score >= 65 ? "Needs Review" : "Action Required",
    criticalCount,
    highCount,
    mediumCount,
    lowCount
  };
}
