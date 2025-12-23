/**
 * Determines whether a server should receive another hourly update.
 * Returns true when the last update timestamp is missing, invalid or falls in a different UTC hour/day.
 */
export function shouldUpdateHourlyServer(
  lastUpdated: string | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastUpdated) return true; // Never updated, should update

  const lastUpdateTime = new Date(lastUpdated);
  if (Number.isNaN(lastUpdateTime.getTime())) {
    return true; // Corrupt timestamp - force refresh
  }

  const lastHour = lastUpdateTime.getUTCHours();
  const currentHour = now.getUTCHours();

  const lastYear = lastUpdateTime.getUTCFullYear();
  const currentYear = now.getUTCFullYear();
  const lastMonth = lastUpdateTime.getUTCMonth();
  const currentMonth = now.getUTCMonth();
  const lastDay = lastUpdateTime.getUTCDate();
  const currentDay = now.getUTCDate();

  return (
    lastHour !== currentHour ||
    lastDay !== currentDay ||
    lastMonth !== currentMonth ||
    lastYear !== currentYear
  );
}

