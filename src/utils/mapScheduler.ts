import type { Client } from "discord.js";
import cron from "node-cron";
import { logger } from "./logger";
import { postOrUpdateMapMessages } from "./messageManager";

/**
 * Update the map status message
 */
export async function updateMapStatus(client: Client): Promise<void> {
  try {
    await postOrUpdateMapMessages(client);
  } catch (error) {
    logger.error({ err: error }, "Error updating map status");
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
    async () => {
      logger.info(`Hourly map rotation update triggered (cron) at ${new Date().toISOString()}`);
      await updateMapStatus(client);
    },
    {
      timezone: "UTC",
    },
  );

  logger.info("Map rotation cron scheduler initialized (runs at :00 of every hour UTC)");

  // Run immediately on startup
  logger.info("Running initial map rotation update...");
  updateMapStatus(client).then(() => {
    logger.info("Initial update complete");
  });
}
