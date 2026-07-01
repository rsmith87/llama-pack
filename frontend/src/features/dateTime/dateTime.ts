export type DateTimeDisplay = {
  label: string;
  title: string;
};

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch (err) {
    if (err instanceof RangeError) return false;
    throw err;
  }
}

export function normalizeDisplayTimeZone(timeZone: string): string {
  const trimmed = timeZone.trim();
  if (!trimmed) return browserTimeZone();
  if (!isValidTimeZone(trimmed)) {
    throw new RangeError(`Invalid display timezone: ${trimmed}`);
  }
  return trimmed;
}

export function formatDateTime(value: string | null | undefined, timeZone: string): DateTimeDisplay {
  if (!value) return { label: "-", title: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: value, title: value };
  const normalizedTimeZone = normalizeDisplayTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: normalizedTimeZone,
    timeZoneName: "short",
  });
  return {
    label: formatter.format(date),
    title: date.toISOString(),
  };
}
