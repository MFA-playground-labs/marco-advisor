export type BookingType = "hotel" | "flight" | "car" | "activity" | "other";
export type BookingStatus = "pending_review" | "confirmed" | "cancelled" | "rejected";
export type IssueSeverity = "critical" | "high" | "medium" | "low";
export type IssueStatus = "unresolved" | "in_progress" | "resolved" | "risk_accepted" | "dismissed";
export type ExtractionJobStatus = "queued" | "processing" | "succeeded" | "failed";

export type Trip = {
  id: string;
  owner_id: string;
  name: string;
  destination: string | null;
  starts_on: string | null;
  ends_on: string | null;
  created_at?: string;
};

export type Traveler = {
  id: string;
  trip_id: string;
  name: string;
  email: string | null;
};

export type Booking = {
  id: string;
  trip_id: string;
  type: BookingType;
  status: BookingStatus;
  vendor: string;
  title: string;
  location: string | null;
  confirmation_code: string | null;
  starts_at: string | null;
  ends_at: string | null;
  total_amount: number | null;
  currency: string | null;
  refundable: boolean | null;
  cancellation_deadline: string | null;
  traveler_names: string[];
  source_upload_id: string | null;
  confidence: number | null;
  missing_fields: string[];
  notes: string | null;
};

export type BookingSegment = {
  id: string;
  booking_id: string;
  trip_id: string;
  type: BookingType;
  label: string;
  starts_at: string | null;
  ends_at: string | null;
  origin: string | null;
  destination: string | null;
  location: string | null;
};

export type UploadRecord = {
  id: string;
  trip_id: string | null;
  owner_id: string;
  filename: string;
  content_type: string;
  storage_path: string;
  status: "uploaded" | "extracting" | "review_ready" | "failed";
  created_at?: string;
};

export type ExtractionJob = {
  id: string;
  upload_id: string;
  trip_id: string | null;
  status: ExtractionJobStatus;
  error_message: string | null;
  created_at?: string;
  completed_at?: string | null;
};

export type ExtractedBookingCandidate = {
  id: string;
  upload_id: string;
  trip_id: string | null;
  status: "needs_review" | "accepted" | "rejected";
  booking_type: BookingType;
  title: string;
  vendor: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  total_amount: number | null;
  currency: string | null;
  refundable: boolean | null;
  cancellation_deadline: string | null;
  traveler_names: string[];
  confirmation_code: string | null;
  confidence: number;
  missing_fields: string[];
  raw_json: unknown;
};

export type TripIssue = {
  id: string;
  trip_id: string;
  severity: IssueSeverity;
  status: IssueStatus;
  category: string;
  title: string;
  summary: string;
  starts_at: string | null;
  ends_at: string | null;
  financial_impact: number | null;
  currency: string | null;
  related_booking_ids: string[];
  recommended_action: string | null;
};

export type FinancialExposure = {
  currentBooked: number;
  locked: number;
  refundable: number;
  conflicting: number;
  missingTbdCount: number;
  cleanEstimate: number;
  currency: string;
};

export type Readiness = {
  score: number;
  label: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
};

export type TripSnapshot = {
  trip: Trip | null;
  travelers: Traveler[];
  bookings: Booking[];
  segments: BookingSegment[];
  candidates: ExtractedBookingCandidate[];
  issues: TripIssue[];
  uploads: UploadRecord[];
  isDemo: boolean;
};
