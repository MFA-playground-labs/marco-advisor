export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      booking_segments: {
        Row: {
          booking_id: string;
          created_at: string;
          destination: string | null;
          ends_at: string | null;
          id: string;
          label: string;
          location: string | null;
          origin: string | null;
          starts_at: string | null;
          trip_id: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          destination?: string | null;
          ends_at?: string | null;
          id?: string;
          label: string;
          location?: string | null;
          origin?: string | null;
          starts_at?: string | null;
          trip_id: string;
          type: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["booking_segments"]["Insert"]>;
      };
      bookings: {
        Row: {
          cancellation_deadline: string | null;
          confidence: number | null;
          confirmation_code: string | null;
          created_at: string;
          currency: string | null;
          ends_at: string | null;
          id: string;
          location: string | null;
          missing_fields: string[];
          notes: string | null;
          refundable: boolean | null;
          source_upload_id: string | null;
          starts_at: string | null;
          status: string;
          title: string;
          total_amount: number | null;
          traveler_names: string[];
          trip_id: string;
          type: string;
          updated_at: string;
          vendor: string;
        };
        Insert: {
          cancellation_deadline?: string | null;
          confidence?: number | null;
          confirmation_code?: string | null;
          created_at?: string;
          currency?: string | null;
          ends_at?: string | null;
          id?: string;
          location?: string | null;
          missing_fields?: string[];
          notes?: string | null;
          refundable?: boolean | null;
          source_upload_id?: string | null;
          starts_at?: string | null;
          status: string;
          title: string;
          total_amount?: number | null;
          traveler_names?: string[];
          trip_id: string;
          type: string;
          updated_at?: string;
          vendor: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
      };
      demo_trip_snapshots: {
        Row: {
          created_at: string;
          slug: string;
          snapshot: Json;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          slug: string;
          snapshot: Json;
          title: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["demo_trip_snapshots"]["Insert"]>;
      };
      extracted_booking_candidates: {
        Row: {
          booking_type: string;
          cancellation_deadline: string | null;
          confidence: number;
          confirmation_code: string | null;
          created_at: string;
          currency: string | null;
          ends_at: string | null;
          extraction_method: string;
          id: string;
          location: string | null;
          missing_fields: string[];
          raw_json: Json;
          refundable: boolean | null;
          source_job_id: string | null;
          source_pages: number[];
          source_snippets: string[];
          starts_at: string | null;
          status: string;
          title: string;
          total_amount: number | null;
          traveler_names: string[];
          trip_id: string;
          updated_at: string;
          upload_id: string;
          vendor: string | null;
        };
        Insert: {
          booking_type: string;
          cancellation_deadline?: string | null;
          confidence?: number;
          confirmation_code?: string | null;
          created_at?: string;
          currency?: string | null;
          ends_at?: string | null;
          extraction_method?: string;
          id?: string;
          location?: string | null;
          missing_fields?: string[];
          raw_json?: Json;
          refundable?: boolean | null;
          source_job_id?: string | null;
          source_pages?: number[];
          source_snippets?: string[];
          starts_at?: string | null;
          status: string;
          title: string;
          total_amount?: number | null;
          traveler_names?: string[];
          trip_id: string;
          updated_at?: string;
          upload_id: string;
          vendor?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["extracted_booking_candidates"]["Insert"]>;
      };
      extraction_jobs: {
        Row: {
          attempt_id: string | null;
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          last_stage: string | null;
          model: string | null;
          provider: string;
          provider_latency_ms: number | null;
          provider_request_id: string | null;
          provider_usage: Json;
          raw_result: Json;
          started_at: string | null;
          status: string;
          trace_id: string | null;
          trip_id: string;
          updated_at: string;
          upload_id: string;
          warnings: string[];
        };
        Insert: {
          attempt_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          last_stage?: string | null;
          model?: string | null;
          provider?: string;
          provider_latency_ms?: number | null;
          provider_request_id?: string | null;
          provider_usage?: Json;
          raw_result?: Json;
          started_at?: string | null;
          status: string;
          trace_id?: string | null;
          trip_id: string;
          updated_at?: string;
          upload_id: string;
          warnings?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["extraction_jobs"]["Insert"]>;
      };
      extraction_job_events: {
        Row: {
          attempt_id: string | null;
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          event: string;
          id: string;
          job_id: string | null;
          metadata: Json;
          model: string | null;
          provider: string | null;
          stage: string | null;
          status: string | null;
          trace_id: string;
          trip_id: string;
          upload_id: string | null;
        };
        Insert: {
          attempt_id?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          event: string;
          id?: string;
          job_id?: string | null;
          metadata?: Json;
          model?: string | null;
          provider?: string | null;
          stage?: string | null;
          status?: string | null;
          trace_id: string;
          trip_id: string;
          upload_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["extraction_job_events"]["Insert"]>;
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      travelers: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          owner_id: string;
          trip_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          owner_id: string;
          trip_id: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["travelers"]["Insert"]>;
      };
      trip_issues: {
        Row: {
          category: string;
          created_at: string;
          currency: string | null;
          ends_at: string | null;
          financial_impact: number | null;
          id: string;
          recommended_action: string | null;
          related_booking_ids: string[];
          severity: string;
          starts_at: string | null;
          status: string;
          summary: string;
          title: string;
          trip_id: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          currency?: string | null;
          ends_at?: string | null;
          financial_impact?: number | null;
          id: string;
          recommended_action?: string | null;
          related_booking_ids?: string[];
          severity: string;
          starts_at?: string | null;
          status: string;
          summary: string;
          title: string;
          trip_id: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trip_issues"]["Insert"]>;
      };
      trips: {
        Row: {
          created_at: string;
          destination: string | null;
          ends_on: string | null;
          id: string;
          name: string;
          owner_id: string;
          starts_on: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          destination?: string | null;
          ends_on?: string | null;
          id?: string;
          name: string;
          owner_id: string;
          starts_on?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trips"]["Insert"]>;
      };
      uploads: {
        Row: {
          content_type: string;
          created_at: string;
          filename: string;
          id: string;
          owner_id: string;
          status: string;
          storage_path: string;
          trace_id: string | null;
          trip_id: string;
          updated_at: string;
        };
        Insert: {
          content_type: string;
          created_at?: string;
          filename: string;
          id?: string;
          owner_id: string;
          status: string;
          storage_path: string;
          trace_id?: string | null;
          trip_id: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["uploads"]["Insert"]>;
      };
      upload_pages: {
        Row: {
          char_count: number;
          created_at: string;
          extraction_confidence: number | null;
          id: string;
          job_id: string;
          page_number: number;
          text: string;
          trip_id: string;
          upload_id: string;
        };
        Insert: {
          char_count?: number;
          created_at?: string;
          extraction_confidence?: number | null;
          id?: string;
          job_id: string;
          page_number: number;
          text: string;
          trip_id: string;
          upload_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["upload_pages"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Row"];
export type TablesInsert<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Insert"];
export type TablesUpdate<TableName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TableName]["Update"];
