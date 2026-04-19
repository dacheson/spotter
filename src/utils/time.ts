export interface TimestampSource {
  now(): Date;
}

export const systemTimestampSource: TimestampSource = {
  now: () => new Date()
};

export function formatIsoTimestamp(date: Date): string {
  return date.toISOString();
}