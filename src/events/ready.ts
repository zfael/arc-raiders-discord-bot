import type { Client } from "discord.js";
import type { Event } from "../types";
import { logger } from "../utils/logger";
import { updateMapStatus } from "../utils/mapScheduler";

const event: Event = {
  name: "ready",
  once: true,

  async execute(client: Client) {
    logger.info(`Bot is ready! Logged in as ${client.user?.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

    // Update map status immediately on startup (only pin-edit method to avoid spam)
    logger.info("Updating map rotation status (pin-edit only)...");
    await updateMapStatus(client, ["pin-edit"]);
  },
};

module.exports = event;
