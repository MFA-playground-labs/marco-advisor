import type { User } from "@supabase/supabase-js";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/lib/database.types";
import type { createSupabaseServerClient } from "@/lib/supabase";
import type {
  Booking,
  BookingSegment,
  ExtractionJob,
  ExtractedBookingCandidate,
  PipelineSnapshot,
  Trip,
  TripIssue,
  TripSnapshot,
  Traveler,
  UploadPageText,
  UploadRecord
} from "@/lib/types";
import {
  WorkflowError,
  asyncExtractionMigrationMessage,
  isAsyncExtractionSchemaCacheError
} from "@/lib/server/errors";

export type AppSupabaseClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export type ClaimedExtractionJob = ExtractionJob & { upload: UploadRecord; claimed: boolean };

export type CompleteExtractionJobInput = {
  jobId: string;
  status: "succeeded" | "failed";
  pages: Json;
  trip: Json;
  bookings: Json;
  warnings: string[];
  provider: string;
  model: string | null;
  errorMessage: string | null;
  rawResult: Json;
};

export type CompleteExtractionJobResult = {
  status: "succeeded" | "failed";
  candidates: number;
  duplicate: boolean;
};

export type ExtractionJobObservabilityUpdate = {
  traceId?: string | null;
  attemptId?: string | null;
  lastStage?: string | null;
  providerRequestId?: string | null;
  providerLatencyMs?: number | null;
  providerUsage?: Json;
};

export type RecordExtractionJobEventInput = {
  traceId: string;
  tripId: string;
  event: string;
  jobId?: string | null;
  uploadId?: string | null;
  attemptId?: string | null;
  stage?: string | null;
  status?: string | null;
  provider?: string | null;
  model?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  metadata?: Json;
};

const demoTripSlug = "marco-demo-trip";

function dbError(message: string | undefined, status = 400): never {
  throw new WorkflowError(message ?? "Supabase request failed.", status);
}

function requireData<T>(data: T | null, error: { message: string } | null, status = 400): T {
  if (error) dbError(error.message, status);
  if (!data) dbError("No data returned from Supabase.", status);
  return data;
}

function listData<T>(data: T[] | null, error: { message: string } | null): T[] {
  if (error) dbError(error.message);
  return data ?? [];
}

function isMissingTripArchivedAtError(message: string | undefined) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("trips.archived_at") || (normalized.includes("archived_at") && normalized.includes("schema cache"));
}

function claimedExtractionJobFromRpc(row: any): ClaimedExtractionJob {
  return {
    id: row.id,
    upload_id: row.upload_id,
    trip_id: row.trip_id,
    status: row.status,
    provider: row.provider,
    model: row.model,
    trace_id: row.trace_id ?? null,
    attempt_id: row.attempt_id ?? null,
    last_stage: row.last_stage ?? null,
    provider_request_id: row.provider_request_id ?? null,
    provider_latency_ms: row.provider_latency_ms ?? null,
    provider_usage: row.provider_usage ?? {},
    error_message: row.error_message,
    warnings: row.warnings ?? [],
    raw_result: row.raw_result ?? {},
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    claimed: Boolean(row.claimed),
    upload: {
      id: row.upload_id,
      owner_id: row.upload_owner_id,
      trip_id: row.upload_trip_id,
      filename: row.upload_filename,
      content_type: row.upload_content_type,
      storage_path: row.upload_storage_path,
      status: row.upload_status,
      trace_id: row.upload_trace_id ?? null,
      created_at: row.upload_created_at
    }
  };
}

export function createSupabaseRepository(supabase: AppSupabaseClient) {
  const db = supabase as any;

  return {
    async getCurrentUser() {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser();
      if (error) dbError(error.message, 401);
      return user;
    },

    async requireUser(action: string) {
      const user = await this.getCurrentUser();
      if (!user) {
        throw new WorkflowError(`Anonymous Supabase auth must be enabled before ${action}.`, 401);
      }
      return user;
    },

    async getActiveTrip(ownerId: string) {
      const query = db
        .from("trips")
        .select("*")
        .eq("owner_id", ownerId)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);
      const { data, error } = await query.maybeSingle();
      if (isMissingTripArchivedAtError(error?.message)) {
        const fallback = await db
          .from("trips")
          .select("*")
          .eq("owner_id", ownerId)
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fallback.error) dbError(fallback.error.message);
        return (fallback.data as Trip | null) ?? null;
      }
      if (error) dbError(error.message);
      return (data as Trip | null) ?? null;
    },

    async getTripForOwner(ownerId: string, tripId: string, options: { includeArchived?: boolean } = {}) {
      let query = db
        .from("trips")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("id", tripId);

      if (!options.includeArchived) {
        query = query.is("archived_at", null);
      }

      const { data, error } = await query.maybeSingle();
      if (!options.includeArchived && isMissingTripArchivedAtError(error?.message)) {
        const fallback = await db
          .from("trips")
          .select("*")
          .eq("owner_id", ownerId)
          .eq("id", tripId)
          .maybeSingle();
        if (fallback.error) dbError(fallback.error.message);
        return (fallback.data as Trip | null) ?? null;
      }
      if (error) dbError(error.message);
      return (data as Trip | null) ?? null;
    },

    async listTripsForUser(ownerId: string) {
      const { data, error } = await db
        .from("trips")
        .select("*")
        .eq("owner_id", ownerId)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false });
      return listData(data as Trip[] | null, error);
    },

    async createTrip(input: TablesInsert<"trips">) {
      const { data, error } = await db.from("trips").insert(input).select("*").single();
      return requireData(data as Trip | null, error);
    },

    async updateTrip(id: string, input: TablesUpdate<"trips">) {
      const { error } = await db.from("trips").update(input).eq("id", id);
      if (error) dbError(error.message);
    },

    async updateOwnedTrip(ownerId: string, id: string, input: TablesUpdate<"trips">) {
      const { data, error } = await db
        .from("trips")
        .update(input)
        .eq("owner_id", ownerId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) dbError(error.message);
      if (!data) dbError("Trip not found.", 404);
      return data as Trip;
    },

    async archiveTrip(ownerId: string, id: string) {
      return this.updateOwnedTrip(ownerId, id, { archived_at: new Date().toISOString() });
    },

    async restoreTrip(ownerId: string, id: string) {
      return this.updateOwnedTrip(ownerId, id, { archived_at: null });
    },

    async uploadFile(storagePath: string, file: File, contentType: string) {
      const { error } = await supabase.storage.from("trip-uploads").upload(storagePath, file, {
        contentType,
        upsert: false
      });
      if (error) dbError(error.message);
    },

    async removeUploadedFile(storagePath: string) {
      const { error } = await supabase.storage.from("trip-uploads").remove([storagePath]);
      if (error) dbError(error.message);
    },

    async createSignedUploadUrl(storagePath: string, expiresIn = 300) {
      const { data, error } = await supabase.storage.from("trip-uploads").createSignedUrl(storagePath, expiresIn);
      if (error) dbError(error.message);
      return requireData(data?.signedUrl ? data : null, null);
    },

    async downloadUploadedFile(storagePath: string) {
      const { data, error } = await supabase.storage.from("trip-uploads").download(storagePath);
      return requireData(data as Blob | null, error);
    },

    async createUploadRecord(input: TablesInsert<"uploads">) {
      const { data, error } = await db.from("uploads").insert(input).select("*").single();
      return requireData(data as UploadRecord | null, error);
    },

    async markUploadStatus(id: string, status: UploadRecord["status"]) {
      const { error } = await db.from("uploads").update({ status }).eq("id", id);
      if (error) dbError(error.message);
    },

    async createExtractionJob(input: TablesInsert<"extraction_jobs">) {
      const { data, error } = await db.from("extraction_jobs").insert(input).select("*").single();
      if (isAsyncExtractionSchemaCacheError(error?.message)) {
        const minimalInput = {
          upload_id: input.upload_id,
          trip_id: input.trip_id,
          status: input.status
        };
        const fallback = await db.from("extraction_jobs").insert(minimalInput).select("*").single();
        const job = requireData(fallback.data as Tables<"extraction_jobs"> | null, fallback.error);
        return {
          ...job,
          migration_warning: asyncExtractionMigrationMessage
        } as Tables<"extraction_jobs"> & { migration_warning: string };
      }
      return requireData(data as Tables<"extraction_jobs"> | null, error);
    },

    async markExtractionJob(id: string, input: TablesUpdate<"extraction_jobs">) {
      const { error } = await db.from("extraction_jobs").update(input).eq("id", id);
      if (error) dbError(error.message);
    },

    async updateExtractionJobObservability(id: string, input: ExtractionJobObservabilityUpdate) {
      const update: TablesUpdate<"extraction_jobs"> = {};
      if ("traceId" in input) update.trace_id = input.traceId;
      if ("attemptId" in input) update.attempt_id = input.attemptId;
      if ("lastStage" in input) update.last_stage = input.lastStage;
      if ("providerRequestId" in input) update.provider_request_id = input.providerRequestId;
      if ("providerLatencyMs" in input) update.provider_latency_ms = input.providerLatencyMs;
      if ("providerUsage" in input) update.provider_usage = input.providerUsage;

      if (Object.keys(update).length === 0) return;
      const { error } = await db.from("extraction_jobs").update(update).eq("id", id);
      if (error) dbError(error.message);
    },

    async recordExtractionJobEvent(input: RecordExtractionJobEventInput) {
      const row: TablesInsert<"extraction_job_events"> = {
        trace_id: input.traceId,
        job_id: input.jobId ?? null,
        upload_id: input.uploadId ?? null,
        trip_id: input.tripId,
        attempt_id: input.attemptId ?? null,
        event: input.event,
        stage: input.stage ?? null,
        status: input.status ?? null,
        provider: input.provider ?? null,
        model: input.model ?? null,
        duration_ms: input.durationMs ?? null,
        error_message: input.errorMessage ?? null,
        metadata: input.metadata ?? {}
      };
      const { data, error } = await db.from("extraction_job_events").insert(row).select("*").single();
      return requireData(data as Tables<"extraction_job_events"> | null, error);
    },

    async claimExtractionJob(id: string) {
      const { data, error } = await db.rpc("claim_extraction_job", { input_job_id: id }).single();
      return claimedExtractionJobFromRpc(requireData(data, error, 404));
    },

    async completeExtractionJob(input: CompleteExtractionJobInput): Promise<CompleteExtractionJobResult> {
      const { data, error } = await db
        .rpc("complete_extraction_job", {
          input_job_id: input.jobId,
          input_status: input.status,
          input_pages: input.pages,
          input_trip: input.trip,
          input_bookings: input.bookings,
          input_warnings: input.warnings,
          input_provider: input.provider,
          input_model: input.model,
          input_error_message: input.errorMessage,
          input_raw_result: input.rawResult
        })
        .single();
      const result = requireData(data as CompleteExtractionJobResult | null, error);
      if (result.status !== "succeeded" && result.status !== "failed") {
        dbError("Unexpected extraction completion status returned from Supabase.");
      }
      return {
        status: result.status,
        candidates: Number(result.candidates ?? 0),
        duplicate: Boolean(result.duplicate)
      };
    },

    async getExtractionJobWithUpload(id: string) {
      const { data, error } = await db
        .from("extraction_jobs")
        .select("*, upload:uploads(*)")
        .eq("id", id)
        .single();
      if (error) dbError(error.message, 404);
      return requireData(data as (ExtractionJob & { upload: UploadRecord }) | null, error, 404);
    },

    async replaceUploadPages(pages: TablesInsert<"upload_pages">[]) {
      if (pages.length === 0) return;
      const jobId = pages[0].job_id;
      const deleted = await db.from("upload_pages").delete().eq("job_id", jobId);
      if (deleted.error) dbError(deleted.error.message);
      const inserted = await db.from("upload_pages").insert(pages);
      if (inserted.error) dbError(inserted.error.message);
    },

    async upsertTravelers(tripId: string, ownerId: string, names: string[]) {
      if (names.length === 0) return;
      const { error } = await db.from("travelers").upsert(
        names.map((name) => ({
          trip_id: tripId,
          owner_id: ownerId,
          name,
          email: null
        })),
        { onConflict: "trip_id,name" }
      );
      if (error) dbError(error.message);
    },

    async createCandidates(candidates: TablesInsert<"extracted_booking_candidates">[]) {
      if (candidates.length === 0) return;
      const { error } = await db.from("extracted_booking_candidates").insert(candidates);
      if (error) dbError(error.message);
    },

    async getCandidate(id: string) {
      const { data, error } = await db.from("extracted_booking_candidates").select("*").eq("id", id).single();
      if (error) dbError(error.message, 404);
      return requireData(data as ExtractedBookingCandidate | null, error, 404);
    },

    async markCandidateStatus(id: string, status: ExtractedBookingCandidate["status"]) {
      const { error } = await db.from("extracted_booking_candidates").update({ status }).eq("id", id);
      if (error) dbError(error.message);
    },

    async createBooking(input: TablesInsert<"bookings">) {
      const { data, error } = await db.from("bookings").insert(input).select("*").single();
      return requireData(data as Booking | null, error);
    },

    async createBookingSegment(input: TablesInsert<"booking_segments">) {
      const { error } = await db.from("booking_segments").insert(input);
      if (error) dbError(error.message);
    },

    async getBookingsForTrip(tripId: string) {
      const { data, error } = await db.from("bookings").select("*").eq("trip_id", tripId);
      return listData(data as Booking[] | null, error);
    },

    async replaceTripIssues(tripId: string, issues: TripIssue[]) {
      const deleted = await db.from("trip_issues").delete().eq("trip_id", tripId);
      if (deleted.error) dbError(deleted.error.message);
      if (issues.length === 0) return;
      const inserted = await db.from("trip_issues").insert(issues);
      if (inserted.error) dbError(inserted.error.message);
    },

    async loadDemoTripSnapshot() {
      const { data, error } = await db
        .from("demo_trip_snapshots")
        .select("snapshot")
        .eq("slug", demoTripSlug)
        .maybeSingle();
      if (error || !data?.snapshot) return null;
      return data.snapshot as Partial<TripSnapshot>;
    },

    async getTripSnapshotForUser(user: User, tripId?: string | null) {
      const trip = tripId
        ? await this.getTripForOwner(user.id, tripId)
        : await this.getActiveTrip(user.id);
      if (!trip) return null;

      return this.getTripSnapshot(trip);
    },

    async getTripSnapshot(trip: Trip) {
      const [travelers, bookings, segments, candidates, issues, uploads] = await Promise.all([
        db.from("travelers").select("*").eq("trip_id", trip.id).order("name"),
        db.from("bookings").select("*").eq("trip_id", trip.id).order("starts_at", { nullsFirst: false }),
        db.from("booking_segments").select("*").eq("trip_id", trip.id).order("starts_at", { nullsFirst: false }),
        db.from("extracted_booking_candidates").select("*").eq("trip_id", trip.id).order("created_at", { ascending: false }),
        db.from("trip_issues").select("*").eq("trip_id", trip.id).order("created_at", { ascending: false }),
        db.from("uploads").select("*").eq("trip_id", trip.id).order("created_at", { ascending: false })
      ]);

      return {
        trip,
        travelers: listData(travelers.data as Traveler[] | null, travelers.error),
        bookings: listData(bookings.data as Booking[] | null, bookings.error),
        segments: listData(segments.data as BookingSegment[] | null, segments.error),
        candidates: listData(candidates.data as ExtractedBookingCandidate[] | null, candidates.error),
        issues: listData(issues.data as TripIssue[] | null, issues.error),
        uploads: listData(uploads.data as UploadRecord[] | null, uploads.error),
        isDemo: false
      } satisfies TripSnapshot;
    },

    async getPipelineSnapshotForUser(user: User, tripId?: string | null): Promise<PipelineSnapshot | null> {
      const snapshot = await this.getTripSnapshotForUser(user, tripId);
      if (!snapshot || !snapshot.trip) return null;

      const [jobs, pages] = await Promise.all([
        db.from("extraction_jobs").select("*").eq("trip_id", snapshot.trip.id).order("created_at", { ascending: false }),
        db.from("upload_pages").select("*").eq("trip_id", snapshot.trip.id).order("page_number")
      ]);

      return {
        ...snapshot,
        jobs: listData(jobs.data as ExtractionJob[] | null, jobs.error),
        pages: listData(pages.data as UploadPageText[] | null, pages.error)
      } satisfies PipelineSnapshot;
    }
  };
}

export type SupabaseRepository = ReturnType<typeof createSupabaseRepository>;
