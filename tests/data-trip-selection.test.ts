import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseRepository: vi.fn(),
  getSelectedTripId: vi.fn()
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));

vi.mock("@/lib/server/supabase-repository", () => ({
  createSupabaseRepository: mocks.createSupabaseRepository
}));

vi.mock("@/lib/server/trip-selection", () => ({
  getSelectedTripId: mocks.getSelectedTripId
}));

import { getActiveTripSnapshot, getPipelineSnapshot } from "@/lib/data";
import type { Trip, TripSnapshot } from "@/lib/types";

const user = { id: "user-1" };
const activeTrip: Trip = {
  id: "trip-1",
  owner_id: user.id,
  name: "Italy",
  destination: "Italy",
  starts_on: "2026-06-01",
  ends_on: "2026-06-10",
  archived_at: null
};
const archivedTrip: Trip = {
  ...activeTrip,
  id: "trip-2",
  archived_at: "2026-07-01T00:00:00Z"
};
const snapshot: TripSnapshot = {
  trip: activeTrip,
  travelers: [],
  bookings: [],
  segments: [],
  candidates: [],
  issues: [],
  uploads: [],
  isDemo: false
};

describe("selected trip data loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
    mocks.getSelectedTripId.mockResolvedValue(null);
  });

  it("does not show the public demo when an authenticated user only has archived trips", async () => {
    const repo = {
      getCurrentUser: vi.fn().mockResolvedValue(user),
      getTripForOwner: vi.fn(),
      getActiveTrip: vi.fn().mockResolvedValue(null),
      listTripsForUser: vi.fn().mockResolvedValue([archivedTrip]),
      getTripSnapshot: vi.fn(),
      loadDemoTripSnapshot: vi.fn()
    };
    mocks.createSupabaseRepository.mockReturnValue(repo);

    await expect(getActiveTripSnapshot()).resolves.toMatchObject({
      trip: null,
      isDemo: false
    });

    expect(repo.loadDemoTripSnapshot).not.toHaveBeenCalled();
  });

  it("falls back from a stale selected trip to the current active trip", async () => {
    mocks.getSelectedTripId.mockResolvedValue("stale-trip");
    const repo = {
      getCurrentUser: vi.fn().mockResolvedValue(user),
      getTripForOwner: vi.fn().mockResolvedValue(null),
      getActiveTrip: vi.fn().mockResolvedValue(activeTrip),
      listTripsForUser: vi.fn(),
      getTripSnapshot: vi.fn().mockResolvedValue(snapshot),
      loadDemoTripSnapshot: vi.fn()
    };
    mocks.createSupabaseRepository.mockReturnValue(repo);

    await expect(getActiveTripSnapshot()).resolves.toMatchObject({
      trip: { id: activeTrip.id },
      isDemo: false
    });

    expect(repo.getTripForOwner).toHaveBeenCalledWith(user.id, "stale-trip");
    expect(repo.getActiveTrip).toHaveBeenCalledWith(user.id);
    expect(repo.getTripSnapshot).toHaveBeenCalledWith(activeTrip);
  });

  it("returns an empty private pipeline snapshot when all trips are archived", async () => {
    const repo = {
      getCurrentUser: vi.fn().mockResolvedValue(user),
      getTripForOwner: vi.fn(),
      getActiveTrip: vi.fn().mockResolvedValue(null),
      listTripsForUser: vi.fn().mockResolvedValue([archivedTrip]),
      getPipelineSnapshotForUser: vi.fn()
    };
    mocks.createSupabaseRepository.mockReturnValue(repo);

    await expect(getPipelineSnapshot()).resolves.toMatchObject({
      trip: null,
      isDemo: false,
      jobs: [],
      pages: []
    });

    expect(repo.getPipelineSnapshotForUser).not.toHaveBeenCalled();
  });
});
