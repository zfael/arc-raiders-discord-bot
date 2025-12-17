import type { Client } from "discord.js";
import type { Event } from "../types";
import { logger } from "../utils/logger";
import { updateMapStatus } from "../utils/mapScheduler";

const event: Event = {
  name: "clientReady",
  once: true,

  async execute(client: Client) {
    logger.info(`Bot is ready! Logged in as ${client.user?.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

    // Update map status immediately on startup for all servers to avoid stale data
    logger.info("Updating map rotation status for all servers...");
    await updateMapStatus(client);
  },
};

module.exports = event;
