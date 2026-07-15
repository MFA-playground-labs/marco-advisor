"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, RotateCcw } from "lucide-react";
import { Card, StatusPill } from "@/components/ui";
import type { TripList, Trip } from "@/lib/types";
import { dateRange } from "@/lib/utils";

export function TripManager({ tripList }: { tripList: TripList }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const busy = Boolean(busyAction);

  async function submitJson(url: string, init: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Trip action failed.");
    return payload;
  }

  async function submitAction(url: string) {
    const response = await fetch(url, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Trip action failed.");
    return payload;
  }

  async function run(action: () => Promise<void>, message: string, actionId: string) {
    setStatus("");
    setBusyAction(actionId);
    try {
      await action();
      setStatus(message);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Trip action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  function createTrip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    void run(async () => {
      await submitJson("/api/trips", {
        method: "POST",
        body: JSON.stringify(formPayload(formData))
      });
      form.reset();
    }, "Trip created and selected.", "create");
  }

  function updateTrip(event: React.FormEvent<HTMLFormElement>, tripId: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void run(async () => {
      await submitJson(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify(formPayload(formData))
      });
    }, "Trip updated.", `update-${tripId}`);
  }

  function selectTrip(tripId: string) {
    void run(async () => {
      await submitAction(`/api/trips/${tripId}/select`);
    }, "Trip selected.", `select-${tripId}`);
  }

  function archiveTrip(tripId: string) {
    void run(async () => {
      await submitAction(`/api/trips/${tripId}/archive`);
    }, "Trip archived.", `archive-${tripId}`);
  }

  function restoreTrip(tripId: string) {
    void run(async () => {
      await submitAction(`/api/trips/${tripId}/restore`);
    }, "Trip restored and selected.", `restore-${tripId}`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section>
          <h2 className="mb-3 font-display text-3xl font-bold">Active Trips</h2>
          {tripList.active.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">Create a trip to start collecting evidence.</Card>
          ) : (
            <div className="space-y-4">
              {tripList.active.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  selected={trip.id === tripList.selectedTripId}
                  disabled={busy}
                  onSubmit={updateTrip}
                  onSelect={selectTrip}
                  onArchive={archiveTrip}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-3xl font-bold">Past Trip Cleanup</h2>
          {tripList.past.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">No ended active trips are waiting for cleanup.</Card>
          ) : (
            <div className="space-y-3">
              {tripList.past.map((trip) => (
                <Card key={trip.id} className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <h3 className="font-black">{trip.name}</h3>
                    <p className="text-sm text-slate-500">{trip.destination ?? "Destination TBD"} · {dateRange(trip.starts_on, trip.ends_on)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => archiveTrip(trip.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                  >
                    <Archive size={16} />
                    Archive
                  </button>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Create Trip</h2>
          <form onSubmit={createTrip} className="mt-4 space-y-3">
            <TripFields />
            <button disabled={busy} className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-black text-white disabled:opacity-60">
              Create and select
            </button>
          </form>
          <p aria-live="polite" className="mt-4 min-h-5 text-sm font-semibold text-slate-600">
            {busyAction ? "Working..." : status}
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Archived Trips</h2>
          <div className="mt-4 space-y-3">
            {tripList.archived.length === 0 ? (
              <p className="text-sm text-slate-500">Archived trips will appear here.</p>
            ) : (
              tripList.archived.map((trip) => (
                <div key={trip.id} className="border-t border-line pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{trip.name}</h3>
                      <p className="text-sm text-slate-500">{dateRange(trip.starts_on, trip.ends_on)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => restoreTrip(trip.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-xs font-black disabled:opacity-60"
                    >
                      <RotateCcw size={14} />
                      Restore
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}

function TripCard({
  trip,
  selected,
  disabled,
  onSubmit,
  onSelect,
  onArchive
}: {
  trip: Trip;
  selected: boolean;
  disabled: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>, tripId: string) => void;
  onSelect: (tripId: string) => void;
  onArchive: (tripId: string) => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-bold">{trip.name}</h3>
          <p className="text-sm text-slate-500">{trip.destination ?? "Destination TBD"} · {dateRange(trip.starts_on, trip.ends_on)}</p>
        </div>
        {selected ? <StatusPill tone="green">Selected</StatusPill> : <StatusPill>Active</StatusPill>}
      </div>
      <form onSubmit={(event) => onSubmit(event, trip.id)} className="grid gap-3 md:grid-cols-2">
        <TripFields trip={trip} />
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button disabled={disabled} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            <Check size={16} />
            Save
          </button>
          {!selected && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(trip.id)}
              className="rounded-lg border border-line px-4 py-2 text-sm font-black disabled:opacity-60"
            >
              Select
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onArchive(trip.id)}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-black disabled:opacity-60"
          >
            <Archive size={16} />
            Archive
          </button>
        </div>
      </form>
    </Card>
  );
}

function TripFields({ trip }: { trip?: Trip }) {
  return (
    <>
      <label className="block text-sm font-bold">
        Trip name
        <input name="name" required defaultValue={trip?.name ?? ""} className="mt-2 w-full rounded-lg border border-line px-3 py-2" placeholder="Italy Summer 2026" />
      </label>
      <label className="block text-sm font-bold">
        Destination
        <input name="destination" defaultValue={trip?.destination ?? ""} className="mt-2 w-full rounded-lg border border-line px-3 py-2" placeholder="Italy" />
      </label>
      <label className="block text-sm font-bold">
        Starts on
        <input name="starts_on" type="date" defaultValue={trip?.starts_on ?? ""} className="mt-2 w-full rounded-lg border border-line px-3 py-2" />
      </label>
      <label className="block text-sm font-bold">
        Ends on
        <input name="ends_on" type="date" defaultValue={trip?.ends_on ?? ""} className="mt-2 w-full rounded-lg border border-line px-3 py-2" />
      </label>
    </>
  );
}

function formPayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    destination: String(formData.get("destination") ?? ""),
    starts_on: String(formData.get("starts_on") ?? ""),
    ends_on: String(formData.get("ends_on") ?? "")
  };
}
