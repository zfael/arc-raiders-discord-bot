import type { Guild } from "discord.js";
import type { Event } from "../types";
import { logger } from "../utils/logger";

const GuildCreateEvent: Event = {
  name: "guildCreate",
  once: false,
  async execute(guild: Guild) {
    logger.info(`Bot added to server: ${guild.name} (ID: ${guild.id})`);
  },
};

module.exports = GuildCreateEvent;
