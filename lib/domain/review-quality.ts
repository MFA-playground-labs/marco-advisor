export type ConfidenceCategory = {
  label: "high" | "review" | "low";
  tone: "green" | "gold" | "red";
};

export function confidenceCategory(confidence: number): ConfidenceCategory {
  if (confidence >= 0.85) return { label: "high", tone: "green" };
  if (confidence >= 0.7) return { label: "review", tone: "gold" };
  return { label: "low", tone: "red" };
}

export function sourceSnippetPreview(snippets: string[] | undefined, maxLength = 220) {
  const snippet = snippets?.find((item) => item.trim().length > 0)?.trim();
  if (!snippet) return null;
  if (snippet.length <= maxLength) return snippet;
  return `${snippet.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
