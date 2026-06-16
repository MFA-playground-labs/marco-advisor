export const defaultOpenAiExtractionModel = "gpt-4.1-mini";
export const defaultN8nExtractionModel = "claude-haiku";

export type ExtractionProvider = "openai" | "n8n";

export function getExtractionProvider(): ExtractionProvider {
  return process.env.EXTRACTION_PROVIDER === "n8n" ? "n8n" : "openai";
}

export function getExtractionModel(provider = getExtractionProvider()) {
  return provider === "openai"
    ? process.env.OPENAI_EXTRACTION_MODEL ?? defaultOpenAiExtractionModel
    : process.env.EXTRACTION_FALLBACK_MODEL ?? defaultN8nExtractionModel;
}

export function getExtractionProviderConfigError(provider = getExtractionProvider()) {
  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    return "OPENAI_API_KEY is required when EXTRACTION_PROVIDER=openai.";
  }

  return null;
}
