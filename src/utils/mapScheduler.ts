import type { Client } from "discord.js";
import cron from "node-cron";
import { logger } from "./logger";
import { postOrUpdateMapMessages } from "./discord/messageManager";

/** Lock to prevent overlapping executions */
let isUpdateRunning = false;

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

/**
 * Update the map status message
 * @param {Client} client The Discord client.
 * @param {string[]} filterByNotificationMethod Optional array of notification methods to filter by.
 */
export async function updateMapStatus(
  client: Client,
  filterByNotificationMethod?: string[],
): Promise<void> {
  // Prevent overlapping executions
  if (isUpdateRunning) {
    logger.warn(
      { filterByNotificationMethod },
      "Skipping scheduled update - previous execution still running",
    );
    return;
  }

  isUpdateRunning = true;
  const startTime = Date.now();

  logger.info({ filterByNotificationMethod }, "Map rotation update started");

  try {
    await postOrUpdateMapMessages(client, filterByNotificationMethod);
  } catch (error) {
    logger.error({ err: error }, "Error updating map status");
  } finally {
    const duration = Date.now() - startTime;
    isUpdateRunning = false;
    logger.info(
      { durationMs: duration, filterByNotificationMethod },
      "Map rotation update completed",
    );
  }
}

/**
 * Initialize the map rotation scheduler
 * Runs at the top of every hour (UTC) using cron
 */
export function initScheduler(client: Client): void {
  const cronExpression = "0 * * * *";
  // Schedule updates at minute 0 of every hour (0 * * * *)
  // This means: "at minute 0, every hour, every day, every month, every day of week"
  const task = cron.schedule(
    cronExpression,
    () => {
      // Don't await - let cron continue while we process
      // The isUpdateRunning lock handles overlap prevention
      logger.info({ triggeredAt: new Date().toISOString() }, "Hourly map rotation cron fired");
      updateMapStatus(client, undefined).catch((error) => {
        logger.error({ err: error }, "Unhandled error in scheduled update");
      });
    },
    {
      timezone: "UTC",
    },
  );

  let nextRun: string | null = null;
  if (typeof task.getNextRun === "function") {
    try {
      const next = task.getNextRun();
      if (next instanceof Date && !Number.isNaN(next.getTime())) {
        nextRun = next.toISOString();
      }
    } catch (error) {
      logger.debug({ err: error }, "Could not determine next cron run time");
    }
  }

  logger.info(
    { cronExpression, nextRun },
    "Map rotation cron scheduler initialized (runs at :00 of every hour UTC)",
  );
}
