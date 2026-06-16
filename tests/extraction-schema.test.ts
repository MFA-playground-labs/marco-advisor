import { describe, expect, it } from "vitest";
import { extractedBookingSchema, extractionJsonSchema, extractionResultSchema } from "@/lib/extraction-schema";

describe("extractionResultSchema", () => {
  it("accepts reviewable booking candidates without inventing required data", () => {
    const result = extractionResultSchema.parse({
      trip: {
        name: "Uploaded Italy trip",
        destination: "Italy",
        starts_on: null,
        ends_on: null,
        travelers: ["Marco Agosin"]
      },
      bookings: [
        {
          booking_type: "hotel",
          title: "Hotel confirmation",
          vendor: null,
          location: null,
          starts_at: null,
          ends_at: null,
          total_amount: null,
          currency: null,
          refundable: null,
          cancellation_deadline: null,
          traveler_names: ["Marco Agosin"],
          confirmation_code: null,
          confidence: 0.42,
          missing_fields: ["starts_at", "ends_at"],
          notes: "Dates were not visible."
        }
      ],
      warnings: []
    });

    expect(result.bookings[0].missing_fields).toEqual(["starts_at", "ends_at"]);
    expect(result.bookings[0].confidence).toBe(0.42);
  });

  it("rejects unsupported booking types", () => {
    expect(() =>
      extractionResultSchema.parse({
        trip: { name: null, destination: null, starts_on: null, ends_on: null, travelers: [] },
        bookings: [{ booking_type: "cruise", title: "Bad", confidence: 1 }],
        warnings: []
      })
    ).toThrow();
  });

  it("accepts OpenAI as an extraction method in runtime and JSON schemas", () => {
    const booking = extractedBookingSchema.parse({
      booking_type: "hotel",
      title: "OpenAI extracted hotel",
      extraction_method: "openai"
    });

    expect(booking.extraction_method).toBe("openai");
    expect(
      extractionJsonSchema.schema.properties.bookings.items.properties.extraction_method.enum
    ).toContain("openai");
  });
});
