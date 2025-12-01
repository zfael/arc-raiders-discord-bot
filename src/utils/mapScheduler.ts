import type { Client } from "discord.js";
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
 * Runs at the top of every hour (UTC)
 */
export function initScheduler(client: Client): void {
  const scheduleNext = () => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const delay = nextHour.getTime() - now.getTime();

    logger.info(
      `📅 Next map rotation update scheduled in ${Math.round(delay / 1000 / 60)} minutes`,
    );

    setTimeout(async () => {
      logger.info("⏰ Hourly map rotation update triggered");
      await updateMapStatus(client);
      scheduleNext();
    }, delay);
  };

  // Start the cycle
  scheduleNext();
  logger.info("📅 Map rotation scheduler initialized");
}
