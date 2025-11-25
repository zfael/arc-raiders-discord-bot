import { Guild } from 'discord.js';
import { removeServerConfig } from '../utils/serverConfig';
import { logger } from '../utils/logger';
import { Event } from '../types';

const GuildDeleteEvent: Event = {
  name: 'guildDelete',
  once: false,
  async execute(guild: Guild) {
    logger.info(`Bot removed from server: ${guild.name} (${guild.id})`);
    removeServerConfig(guild.id);
  },
};

module.exports = GuildDeleteEvent;
