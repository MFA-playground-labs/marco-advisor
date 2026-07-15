export const defaultOpenAiExtractionModel = "gpt-4.1-mini";
export const extractionProvider = "openai";

export type ExtractionProvider = typeof extractionProvider;

export function getExtractionProvider(): ExtractionProvider {
  return extractionProvider;
}

export function getExtractionModel() {
  return process.env.OPENAI_EXTRACTION_MODEL ?? defaultOpenAiExtractionModel;
}

export function getExtractionProviderConfigError() {
  if (!process.env.OPENAI_API_KEY) {
    return "OPENAI_API_KEY is required for OpenAI extraction.";
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY is required for OpenAI extraction.";
  }

  return null;
}
