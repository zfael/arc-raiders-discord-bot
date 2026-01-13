import type { Client } from "discord.js";
import cron from "node-cron";
import { logger } from "./logger";
import { postOrUpdateMapMessages } from "./messageManager";
import { syncMapRotations } from "../services/mapRotationSync";

const DEFAULT_SYNC_CRON = "0 0 * * *"; // Daily at midnight UTC

/**
 * Update the map status message
 * @param {Client} client The Discord client.
 * @param {string[]} filterByNotificationMethod Optional array of notification methods to filter by.
 */
export async function updateMapStatus(
  client: Client,
  filterByNotificationMethod?: string[],
): Promise<void> {
  try {
    await postOrUpdateMapMessages(client, filterByNotificationMethod);
  } catch (error) {
    logger.error({ err: error }, "Error updating map status");
  }
}

/**
 * Initialize the sync scheduler for Google Sheets
 * Syncs map rotation data from Google Sheets on a configurable schedule
 */
export function initSyncScheduler(client: Client): void {
  const syncCron = process.env.MAP_SYNC_CRON || DEFAULT_SYNC_CRON;

  if (!cron.validate(syncCron)) {
    logger.error(`Invalid MAP_SYNC_CRON value: ${syncCron}, using default: ${DEFAULT_SYNC_CRON}`);
  }

  const schedule = cron.validate(syncCron) ? syncCron : DEFAULT_SYNC_CRON;

  cron.schedule(
    schedule,
    async () => {
      logger.info(`Map rotation sync triggered (cron) at ${new Date().toISOString()}`);
      await syncMapRotations(client);
    },
    {
      timezone: "UTC",
    },
  );

  logger.info(`Map rotation sync scheduler initialized (cron: ${schedule})`);

  // Run initial sync on startup
  syncMapRotations(client).then((result) => {
    if (result.success) {
      logger.info("Initial map rotation sync completed");
    }
  });
}

/**
 * Initialize the map rotation scheduler
 * Runs at the top of every hour (UTC) using cron
 */
export function initScheduler(client: Client): void {
  // Initialize sync scheduler first
  initSyncScheduler(client);

  // Schedule updates at minute 0 of every hour (0 * * * *)
  // This means: "at minute 0, every hour, every day, every month, every day of week"
  cron.schedule(
    "0 * * * *",
    async () => {
      logger.info(`Hourly map rotation update triggered (cron) at ${new Date().toISOString()}`);
      await updateMapStatus(client);
    },
    {
      timezone: "UTC",
    },
  );

  logger.info("Map rotation cron scheduler initialized (runs at :00 of every hour UTC)");
}
