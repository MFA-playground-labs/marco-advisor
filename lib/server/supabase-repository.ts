import type { User } from "@supabase/supabase-js";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/database.types";
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
import { WorkflowError } from "@/lib/server/errors";

export type AppSupabaseClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

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
      const { data, error } = await db
        .from("trips")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) dbError(error.message);
      return (data as Trip | null) ?? null;
    },

    async createTrip(input: TablesInsert<"trips">) {
      const { data, error } = await db.from("trips").insert(input).select("*").single();
      return requireData(data as Trip | null, error);
    },

    async updateTrip(id: string, input: TablesUpdate<"trips">) {
      const { error } = await db.from("trips").update(input).eq("id", id);
      if (error) dbError(error.message);
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
      return requireData(data as Tables<"extraction_jobs"> | null, error);
    },

    async markExtractionJob(id: string, input: TablesUpdate<"extraction_jobs">) {
      const { error } = await db.from("extraction_jobs").update(input).eq("id", id);
      if (error) dbError(error.message);
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

    async getTripSnapshotForUser(user: User) {
      const trip = await this.getActiveTrip(user.id);
      if (!trip) return null;

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

    async getPipelineSnapshotForUser(user: User): Promise<PipelineSnapshot | null> {
      const snapshot = await this.getTripSnapshotForUser(user);
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
