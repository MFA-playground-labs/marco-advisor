import { z } from "zod";

export const extractedBookingSchema = z.object({
  booking_type: z.enum(["hotel", "flight", "car", "activity", "other"]),
  title: z.string().min(1),
  vendor: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  starts_at: z.string().nullable().default(null),
  ends_at: z.string().nullable().default(null),
  total_amount: z.number().nullable().default(null),
  currency: z.string().nullable().default(null),
  refundable: z.boolean().nullable().default(null),
  cancellation_deadline: z.string().nullable().default(null),
  traveler_names: z.array(z.string()).default([]),
  confirmation_code: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.5),
  missing_fields: z.array(z.string()).default([]),
  source_pages: z.array(z.number().int().positive()).default([]),
  source_snippets: z.array(z.string()).default([]),
  extraction_method: z.enum(["rules", "haiku", "openai", "manual"]).default("haiku"),
  notes: z.string().nullable().default(null)
});

export const extractionResultSchema = z.object({
  trip: z.object({
    name: z.string().nullable().default(null),
    destination: z.string().nullable().default(null),
    starts_on: z.string().nullable().default(null),
    ends_on: z.string().nullable().default(null),
    travelers: z.array(z.string()).default([])
  }),
  bookings: z.array(extractedBookingSchema),
  warnings: z.array(z.string()).default([])
});

export type ExtractedBookingPayload = z.infer<typeof extractedBookingSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export const extractionJsonSchema = {
  name: "marco_booking_extraction",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["trip", "bookings", "warnings"],
    properties: {
      trip: {
        type: "object",
        additionalProperties: false,
        required: ["name", "destination", "starts_on", "ends_on", "travelers"],
        properties: {
          name: { type: ["string", "null"] },
          destination: { type: ["string", "null"] },
          starts_on: { type: ["string", "null"] },
          ends_on: { type: ["string", "null"] },
          travelers: { type: "array", items: { type: "string" } }
        }
      },
      bookings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "booking_type",
            "title",
            "vendor",
            "location",
            "starts_at",
            "ends_at",
            "total_amount",
            "currency",
            "refundable",
            "cancellation_deadline",
            "traveler_names",
            "confirmation_code",
            "confidence",
            "missing_fields",
            "source_pages",
            "source_snippets",
            "extraction_method",
            "notes"
          ],
          properties: {
            booking_type: { type: "string", enum: ["hotel", "flight", "car", "activity", "other"] },
            title: { type: "string" },
            vendor: { type: ["string", "null"] },
            location: { type: ["string", "null"] },
            starts_at: { type: ["string", "null"] },
            ends_at: { type: ["string", "null"] },
            total_amount: { type: ["number", "null"] },
            currency: { type: ["string", "null"] },
            refundable: { type: ["boolean", "null"] },
            cancellation_deadline: { type: ["string", "null"] },
            traveler_names: { type: "array", items: { type: "string" } },
            confirmation_code: { type: ["string", "null"] },
            confidence: { type: "number" },
            missing_fields: { type: "array", items: { type: "string" } },
            source_pages: { type: "array", items: { type: "number" } },
            source_snippets: { type: "array", items: { type: "string" } },
            extraction_method: { type: "string", enum: ["rules", "haiku", "openai", "manual"] },
            notes: { type: ["string", "null"] }
          }
        }
      },
      warnings: { type: "array", items: { type: "string" } }
    }
  },
  strict: true
} as const;
