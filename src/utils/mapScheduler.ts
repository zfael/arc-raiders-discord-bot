import { Client } from 'discord.js';
import * as cron from 'node-cron';
import { postOrUpdateMapMessages } from './messageManager';
import { logger } from './logger';

/**
 * Update the map status message
 */
export async function updateMapStatus(client: Client): Promise<void> {
  try {
    await postOrUpdateMapMessages(client);
  } catch (error) {
    logger.error({ err: error }, 'Error updating map status');
  }
}

/**
 * Initialize the map rotation scheduler
 * Runs at the top of every hour (UTC)
 */
export function initScheduler(client: Client): void {
  // Schedule to run at the start of every hour
  // Cron format: minute hour day month weekday
  // '0 * * * *' = at minute 0 of every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('⏰ Hourly map rotation update triggered');
    await updateMapStatus(client);
  }, {
    timezone: 'UTC'
  });
  
  logger.info('📅 Map rotation scheduler initialized (runs every hour at :00)');
}
