import type { Client } from "discord.js";
import type { Event } from "../types";
import { i18nPromise } from "../utils/i18n/i18n";
import { logger } from "../utils/logger";
import { runStartupValidation, processValidatedServers } from "../utils/startupValidator";

const event: Event = {
  name: "clientReady",
  once: true,

  async execute(client: Client) {
    logger.info(`Bot is ready! Logged in as ${client.user?.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

    // Ensure i18n is fully initialized before processing any messages
    await i18nPromise;
    logger.info("i18n initialization confirmed");

    // Run startup validation to check for dead guilds, channels, and messages
    // This will clean up invalid entries from the database
    const validationResult = await runStartupValidation(client);

    // Process validated servers:
    // - pin-edit: Update immediately
    // - post-delete/post-keep: Only update if hour boundary crossed since last update
    await processValidatedServers(client, validationResult);
  },
};

module.exports = event;
