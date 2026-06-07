import OpenAI from "openai";
import type { ResponseInputMessageContentList } from "openai/resources/responses/responses";
import { extractionJsonSchema, extractionResultSchema, type ExtractionResult } from "@/lib/extraction-schema";

const extractionPrompt = `
You are Marco, a travel booking extraction system.
Extract only facts visible in the uploaded booking confirmation, email, PDF, document, or screenshot.
Return structured travel bookings suitable for user review.
Use ISO dates when possible. Use null when a field is unknown.
Set confidence below 0.7 when important fields are ambiguous.
Put any unknown required fields in missing_fields.
Do not invent prices, dates, confirmation codes, travelers, or refundability.
`;

export async function extractBookingsFromUpload(input: {
  filename: string;
  contentType: string;
  imageDataUrl?: string;
  fileData?: string;
  fileId?: string;
  text?: string;
}): Promise<ExtractionResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for extraction.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const content: ResponseInputMessageContentList = [
    {
      type: "input_text",
      text: `${extractionPrompt}\nFilename: ${input.filename}\nContent type: ${input.contentType}`
    }
  ];

  if (input.text) {
    content.push({ type: "input_text", text: input.text });
  } else if (input.fileId) {
    const isImage = input.contentType.startsWith("image/");
    content.push(isImage ? { type: "input_image", file_id: input.fileId, detail: "high" } : { type: "input_file", file_id: input.fileId });
  } else if (input.imageDataUrl) {
    content.push({ type: "input_image", image_url: input.imageDataUrl, detail: "high" });
  } else if (input.fileData) {
    content.push({ type: "input_file", file_data: input.fileData, filename: input.filename });
  } else {
    throw new Error("Extraction requires file data, file id, image data, or text input.");
  }

  const response = await client.responses.create({
    model: process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...extractionJsonSchema
      }
    }
  });

  const parsed = JSON.parse(response.output_text);
  return extractionResultSchema.parse(parsed);
}

export async function askMarco(input: {
  question: string;
  context: unknown;
}) {
  if (!process.env.OPENAI_API_KEY) {
    return "Marco AI is ready, but OPENAI_API_KEY is not configured yet.";
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_ADVISOR_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: "You are Marco, a private travel advisor. Explain risks and suggest user-approved next actions. Never claim you booked or cancelled anything."
      },
      {
        role: "user",
        content: `Trip context:\n${JSON.stringify(input.context, null, 2)}\n\nQuestion:\n${input.question}`
      }
    ]
  });

  return response.output_text;
}
