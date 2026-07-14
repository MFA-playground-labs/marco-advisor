import type { PipelineSnapshot, Trip, TripList, TripSnapshot } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase";
import { calculateFinancialExposure, calculateReadiness } from "@/lib/scanner";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { getSelectedTripId } from "@/lib/server/trip-selection";

export async function getActiveTripSnapshot(): Promise<TripSnapshot> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return emptySnapshot();
  const repo = createSupabaseRepository(supabase);

  const user = await repo.getCurrentUser();

  if (!user) return loadDemoTripSnapshot(repo);

  const selectedTripId = await getSelectedTripId();
  const snapshot = selectedTripId
    ? (await repo.getTripSnapshotForUser(user, selectedTripId)) ?? (await repo.getTripSnapshotForUser(user))
    : await repo.getTripSnapshotForUser(user);

  return snapshot ?? loadDemoTripSnapshot(repo);
}

export async function getPipelineSnapshot(): Promise<PipelineSnapshot> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return emptyPipelineSnapshot();
  const repo = createSupabaseRepository(supabase);

  const user = await repo.getCurrentUser();
  if (!user) return emptyPipelineSnapshot();

  const selectedTripId = await getSelectedTripId();
  const snapshot = selectedTripId
    ? (await repo.getPipelineSnapshotForUser(user, selectedTripId)) ?? (await repo.getPipelineSnapshotForUser(user))
    : await repo.getPipelineSnapshotForUser(user);
  return snapshot ?? emptyPipelineSnapshot();
}

export async function getTripList(): Promise<TripList> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return emptyTripList();
  const repo = createSupabaseRepository(supabase);

  const user = await repo.getCurrentUser();
  if (!user) return emptyTripList();

  const selectedTripId = await getSelectedTripId();
  const trips = await repo.listTripsForUser(user.id);
  const active = trips.filter((trip) => !trip.archived_at);
  const archived = trips.filter((trip) => trip.archived_at);
  const selectedIsActive = Boolean(selectedTripId && active.some((trip) => trip.id === selectedTripId));
  const selectedActiveTripId = selectedIsActive ? selectedTripId : active[0]?.id ?? null;

  return {
    active,
    archived,
    past: active.filter(isPastTrip),
    selectedTripId: selectedActiveTripId
  };
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

export function emptyPipelineSnapshot(): PipelineSnapshot {
  return {
    ...emptySnapshot(),
    jobs: [],
    pages: []
  };
}

export function emptyTripList(): TripList {
  return {
    active: [],
    archived: [],
    past: [],
    selectedTripId: null
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

function isPastTrip(trip: Trip) {
  if (!trip.ends_on) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(`${trip.ends_on}T00:00:00.000Z`) < today;
}
