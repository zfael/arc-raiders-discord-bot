import type { Guild } from "discord.js";
import { logger } from "../utils/logger";
import { notifyBotJoined } from "../utils/observabilityWebhook";

module.exports = {
  name: "guildCreate",
  async execute(guild: Guild) {
    logger.info(`Bot added to server: ${guild.name} (ID: ${guild.id})`);

    const totalServers = guild.client.guilds.cache.size;
    await notifyBotJoined(guild.name, guild.id, totalServers, guild.memberCount);
  },
};
