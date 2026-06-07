import type {
  Booking,
  ExtractedBookingCandidate,
  Trip,
  TripIssue,
  TripSnapshot,
  UploadRecord
} from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase";
import { calculateFinancialExposure, calculateReadiness } from "@/lib/scanner";

const demoTripSlug = "marco-demo-trip";

export async function getActiveTripSnapshot(): Promise<TripSnapshot> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return emptySnapshot();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return loadDemoTripSnapshot(supabase);

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!trip) return loadDemoTripSnapshot(supabase);

  const [travelers, bookings, segments, candidates, issues, uploads] = await Promise.all([
    supabase.from("travelers").select("*").eq("trip_id", trip.id).order("name"),
    supabase.from("bookings").select("*").eq("trip_id", trip.id).order("starts_at", { nullsFirst: false }),
    supabase.from("booking_segments").select("*").eq("trip_id", trip.id).order("starts_at", { nullsFirst: false }),
    supabase.from("extracted_booking_candidates").select("*").eq("trip_id", trip.id).order("created_at", { ascending: false }),
    supabase.from("trip_issues").select("*").eq("trip_id", trip.id).order("created_at", { ascending: false }),
    supabase.from("uploads").select("*").eq("trip_id", trip.id).order("created_at", { ascending: false })
  ]);

  return {
    trip: trip as Trip,
    travelers: travelers.data ?? [],
    bookings: (bookings.data ?? []) as Booking[],
    segments: segments.data ?? [],
    candidates: (candidates.data ?? []) as ExtractedBookingCandidate[],
    issues: (issues.data ?? []) as TripIssue[],
    uploads: (uploads.data ?? []) as UploadRecord[],
    isDemo: false
  };
}

async function loadDemoTripSnapshot(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<TripSnapshot> {
  if (!supabase) return emptySnapshot();

  const { data, error } = await supabase
    .from("demo_trip_snapshots")
    .select("snapshot")
    .eq("slug", demoTripSlug)
    .maybeSingle();

  if (error || !data?.snapshot) return emptySnapshot();

  const snapshot = data.snapshot as Partial<TripSnapshot>;
  return {
    ...emptySnapshot(),
    ...snapshot,
    travelers: snapshot.travelers ?? [],
    bookings: snapshot.bookings ?? [],
    segments: snapshot.segments ?? [],
    candidates: snapshot.candidates ?? [],
    issues: snapshot.issues ?? [],
    uploads: snapshot.uploads ?? [],
    isDemo: true
  };
}

export function emptySnapshot(): TripSnapshot {
  return {
    trip: null,
    travelers: [],
    bookings: [],
    segments: [],
    candidates: [],
    issues: [],
    uploads: [],
    isDemo: false
  };
}

export function summarizeSnapshot(snapshot: TripSnapshot) {
  const issues = snapshot.issues;
  const exposure = calculateFinancialExposure(snapshot.bookings, issues);
  const readiness = calculateReadiness(issues);
  const confirmed = snapshot.bookings.filter((booking) => booking.status === "confirmed");
  const pending = snapshot.candidates.filter((candidate) => candidate.status === "needs_review");
  return {
    exposure,
    readiness,
    confirmedCount: confirmed.length,
    pendingReviewCount: pending.length,
    conflictsCount: issues.filter((issue) => issue.category === "double_booking" && issue.status === "unresolved").length,
    nightsCount: confirmed.filter((booking) => booking.type === "hotel").length,
    needsUpload: snapshot.uploads.length === 0 && snapshot.bookings.length === 0 && snapshot.candidates.length === 0
  };
}
