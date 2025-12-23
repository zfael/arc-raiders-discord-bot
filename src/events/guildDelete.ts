import type { Guild } from "discord.js";
import type { Event } from "../types";
import { logger } from "../utils/logger";
import { removeServerConfig } from "../utils/database/serverConfig";

const GuildDeleteEvent: Event = {
  name: "guildDelete",
  once: false,
  async execute(guild: Guild) {
    logger.info(`Bot removed from server: ${guild.name} (${guild.id})`);
    try {
      await removeServerConfig(guild.id);
      logger.info(`Removed server entry from Supabase for guildId: ${guild.id}`);
    } catch (error) {
      logger.error(
        { err: error, guildId: guild.id },
        "Failed to remove server configuration on guild delete",
      );
    }
  },
};

module.exports = GuildDeleteEvent;
