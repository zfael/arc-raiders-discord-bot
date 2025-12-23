import type { Client } from "discord.js";
import cron from "node-cron";
import { logger } from "./logger";
import { postOrUpdateMapMessages } from "./messageManager";

/** Lock to prevent overlapping executions */
let isUpdateRunning = false;

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
    logger.warn("Skipping scheduled update - previous execution still running");
    return;
  }

  isUpdateRunning = true;
  const startTime = Date.now();

  try {
    await postOrUpdateMapMessages(client, filterByNotificationMethod);
  } catch (error) {
    logger.error({ err: error }, "Error updating map status");
  } finally {
    const duration = Date.now() - startTime;
    isUpdateRunning = false;
    logger.info({ durationMs: duration }, "Scheduled update execution completed");
  }
}

/**
 * Initialize the map rotation scheduler
 * Runs at the top of every hour (UTC) using cron
 */
export function initScheduler(client: Client): void {
  // Schedule updates at minute 0 of every hour (0 * * * *)
  // This means: "at minute 0, every hour, every day, every month, every day of week"
  cron.schedule(
    "0 * * * *",
    () => {
      // Don't await - let cron continue while we process
      // The isUpdateRunning lock handles overlap prevention
      logger.info(`Hourly map rotation update triggered (cron) at ${new Date().toISOString()}`);
      updateMapStatus(client).catch((error) => {
        logger.error({ err: error }, "Unhandled error in scheduled update");
      });
    },
    {
      timezone: "UTC",
    },
  );

  logger.info("Map rotation cron scheduler initialized (runs at :00 of every hour UTC)");
}
