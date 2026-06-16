import OpenAI from "openai";
import type { ResponseInputMessageContentList } from "openai/resources/responses/responses";
import type { Json } from "@/lib/database.types";
import { extractionJsonSchema, extractionResultSchema, type ExtractionResult } from "@/lib/extraction-schema";

const extractionPrompt = `
You are Marco, a travel booking extraction system.
Extract only facts visible in the uploaded booking confirmation, email, PDF, document, or screenshot.
Return structured travel bookings suitable for user review.
Use ISO dates when possible. Use null when a field is unknown.
Set confidence below 0.7 when important fields are ambiguous.
Put any unknown required fields in missing_fields.
Do not invent prices, dates, confirmation codes, travelers, or refundability.
For every booking you extract from the uploaded content, set extraction_method to "openai".
`;

export async function extractBookingsFromUpload(input: {
  filename: string;
  contentType: string;
  imageDataUrl?: string;
  fileData?: string;
  fileId?: string;
  text?: string;
}): Promise<{
  result: ExtractionResult;
  provider: {
    responseId: string | null;
    model: string;
    usage: Json;
    rawResult: Json;
  };
}> {
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

  const model = process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-4.1-mini";
  const response = await client.responses.create({
    model,
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
  return {
    result: extractionResultSchema.parse(parsed),
    provider: {
      responseId: typeof response.id === "string" ? response.id : null,
      model: typeof response.model === "string" ? response.model : model,
      usage: toJsonObject((response as { usage?: unknown }).usage),
      rawResult: compactResponseMetadata(response, model)
    }
  };
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

function compactResponseMetadata(response: unknown, requestedModel: string): Json {
  const value = response as {
    id?: unknown;
    model?: unknown;
    status?: unknown;
    usage?: unknown;
    output_text?: unknown;
  };

  return toJsonObject({
    id: typeof value.id === "string" ? value.id : null,
    model: typeof value.model === "string" ? value.model : requestedModel,
    status: typeof value.status === "string" ? value.status : null,
    usage: toJsonObject(value.usage),
    output_text_length: typeof value.output_text === "string" ? value.output_text.length : null
  });
}

function toJsonObject(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value)) as Json;
}
