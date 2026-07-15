type TripLifecycleEventInput = {
  event: string;
  userId?: string | null;
  tripId?: string | null;
  status: "succeeded" | "failed";
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export function logTripLifecycleEvent(input: TripLifecycleEventInput) {
  const payload = {
    user_id: input.userId ?? null,
    trip_id: input.tripId ?? null,
    status: input.status,
    error_message: input.errorMessage ?? null,
    metadata: input.metadata ?? {}
  };

  if (input.status === "failed") {
    console.warn(input.event, payload);
  } else {
    console.info(input.event, payload);
  }
}
