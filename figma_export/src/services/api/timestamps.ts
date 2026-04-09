const API_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/;

export function parseApiTimestamp(timestamp: string): Date {
  const match = API_TIMESTAMP_PATTERN.exec(timestamp);

  if (!match) {
    return new Date(timestamp);
  }

  const [, year, month, day, hour, minute, second, milliseconds = '0'] = match;

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(milliseconds.padEnd(3, '0')),
  );
}
