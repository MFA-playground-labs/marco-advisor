import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function money(amount: number | null | undefined, currency = "EUR") {
  if (amount === null || amount === undefined) return "TBD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function compactDate(value: string | null | undefined) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function dateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "Dates TBD";
  if (start && end) return `${compactDate(start)} - ${compactDate(end)}`;
  return compactDate(start ?? end);
}
