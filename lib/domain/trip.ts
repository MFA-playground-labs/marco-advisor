export type TripMetadataInput = {
  name: string;
  destination: string | null;
  starts_on: string | null;
  ends_on: string | null;
};

export function normalizeTripMetadataInput(body: any): { input: TripMetadataInput | null; error: string | null } {
  const name = String(body?.name ?? "").trim();
  if (!name) return { input: null, error: "Trip name is required." };

  const startsOn = nullableString(body?.starts_on);
  const endsOn = nullableString(body?.ends_on);

  if (startsOn && !isValidDateString(startsOn)) {
    return { input: null, error: "Trip start date must be a valid YYYY-MM-DD date." };
  }

  if (endsOn && !isValidDateString(endsOn)) {
    return { input: null, error: "Trip end date must be a valid YYYY-MM-DD date." };
  }

  if (startsOn && endsOn && endsOn < startsOn) {
    return { input: null, error: "Trip end date must be on or after the start date." };
  }

  return {
    input: {
      name,
      destination: nullableString(body?.destination),
      starts_on: startsOn,
      ends_on: endsOn
    },
    error: null
  };
}

function nullableString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
