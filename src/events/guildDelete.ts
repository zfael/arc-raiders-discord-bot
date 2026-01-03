import type { Guild } from "discord.js";
import type { Event } from "../types";
import { logger } from "../utils/logger";
import { notifyBotRemoved } from "../utils/observabilityWebhook";
import { removeServerConfig } from "../utils/serverConfig";

const GuildDeleteEvent: Event = {
  name: "guildDelete",
  once: false,
  async execute(guild: Guild) {
    logger.info(`Bot removed from server: ${guild.name} (${guild.id})`);

    const createdAt = await removeServerConfig(guild.id);
    logger.info({ createdAt }, `Removed server entry from Supabase for guildId: ${guild.id}`);

    let daysInServer: number | null = null;
    if (createdAt) {
      daysInServer = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    }

    const totalServers = guild.client.guilds.cache.size;
    await notifyBotRemoved(guild.name, guild.id, daysInServer, totalServers);
  },
};

module.exports = GuildDeleteEvent;
