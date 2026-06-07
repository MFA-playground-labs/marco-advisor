import type { TripSnapshot } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase";
import { calculateFinancialExposure, calculateReadiness } from "@/lib/scanner";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";

export async function getActiveTripSnapshot(): Promise<TripSnapshot> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return emptySnapshot();
  const repo = createSupabaseRepository(supabase);

  const user = await repo.getCurrentUser();

  if (!user) return loadDemoTripSnapshot(repo);

  const snapshot = await repo.getTripSnapshotForUser(user);

  return snapshot ?? loadDemoTripSnapshot(repo);
}

async function loadDemoTripSnapshot(repo: ReturnType<typeof createSupabaseRepository>): Promise<TripSnapshot> {
  const snapshot = await repo.loadDemoTripSnapshot();
  if (!snapshot) return emptySnapshot();
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
