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

vi.mock("@/lib/server/trip-selection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/trip-selection")>();
  return {
    ...actual,
    getSelectedTripId: mocks.getSelectedTripId
  };
});

import { GET, POST } from "@/app/api/trips/route";
import { PATCH } from "@/app/api/trips/[id]/route";
import { POST as selectTrip } from "@/app/api/trips/[id]/select/route";
import { POST as archiveTrip } from "@/app/api/trips/[id]/archive/route";
import { POST as restoreTrip } from "@/app/api/trips/[id]/restore/route";
import type { Trip } from "@/lib/types";

const user = { id: "user-1" };
const activeTrip: Trip = {
  id: "trip-1",
  owner_id: user.id,
  name: "Italy",
  destination: "Italy",
  starts_on: "2026-06-01",
  ends_on: "2026-06-10",
  updated_at: "2026-06-01T00:00:00Z",
  archived_at: null
};
const archivedTrip: Trip = {
  ...activeTrip,
  id: "trip-2",
  name: "Paris",
  archived_at: "2026-07-01T00:00:00Z"
};

function jsonRequest(body: unknown) {
  return new Request("https://example.com/api/trips", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

function params(id = activeTrip.id) {
  return { params: Promise.resolve({ id }) };
}

describe("trip routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({});
    mocks.getSelectedTripId.mockResolvedValue(activeTrip.id);
  });

  it("lists active, archived, and past trips", async () => {
    const repo = {
      requireUser: vi.fn().mockResolvedValue(user),
      listTripsForUser: vi.fn().mockResolvedValue([
        { ...activeTrip, ends_on: "2020-01-01" },
        archivedTrip
      ])
    };
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      active: [{ id: activeTrip.id }],
      archived: [{ id: archivedTrip.id }],
      past: [{ id: activeTrip.id }]
    });
  });

  it("creates and selects a trip", async () => {
    const repo = {
      requireUser: vi.fn().mockResolvedValue(user),
      createTrip: vi.fn().mockResolvedValue(activeTrip)
    };
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await POST(jsonRequest({ name: " Italy ", destination: " Italy " }));

    expect(response.status).toBe(200);
    expect(repo.createTrip).toHaveBeenCalledWith(expect.objectContaining({ name: "Italy", destination: "Italy" }));
    expect(response.headers.get("set-cookie")).toContain("marco_selected_trip_id=trip-1");
  });

  it("updates owned trip metadata", async () => {
    const repo = {
      requireUser: vi.fn().mockResolvedValue(user),
      updateOwnedTrip: vi.fn().mockResolvedValue({ ...activeTrip, name: "Rome" })
    };
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await PATCH(jsonRequest({ name: "Rome", destination: "" }), params());

    expect(response.status).toBe(200);
    expect(repo.updateOwnedTrip).toHaveBeenCalledWith(user.id, activeTrip.id, {
      name: "Rome",
      destination: null,
      starts_on: null,
      ends_on: null
    });
  });

  it("selects only a non-archived owned trip", async () => {
    const repo = {
      requireUser: vi.fn().mockResolvedValue(user),
      getTripForOwner: vi.fn().mockResolvedValue(activeTrip)
    };
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await selectTrip(new Request("https://example.com"), params());

    expect(response.status).toBe(200);
    expect(repo.getTripForOwner).toHaveBeenCalledWith(user.id, activeTrip.id);
    expect(response.headers.get("set-cookie")).toContain("marco_selected_trip_id=trip-1");
  });

  it("clears the selected cookie when archiving the selected trip", async () => {
    const repo = {
      requireUser: vi.fn().mockResolvedValue(user),
      archiveTrip: vi.fn().mockResolvedValue({ ...activeTrip, archived_at: "2026-07-01T00:00:00Z" })
    };
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await archiveTrip(new Request("https://example.com"), params());

    expect(response.status).toBe(200);
    expect(repo.archiveTrip).toHaveBeenCalledWith(user.id, activeTrip.id);
    expect(response.headers.get("set-cookie")).toContain("marco_selected_trip_id=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("restores and selects an archived trip", async () => {
    const repo = {
      requireUser: vi.fn().mockResolvedValue(user),
      restoreTrip: vi.fn().mockResolvedValue({ ...archivedTrip, archived_at: null })
    };
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await restoreTrip(new Request("https://example.com"), params(archivedTrip.id));

    expect(response.status).toBe(200);
    expect(repo.restoreTrip).toHaveBeenCalledWith(user.id, archivedTrip.id);
    expect(response.headers.get("set-cookie")).toContain("marco_selected_trip_id=trip-2");
  });
});
