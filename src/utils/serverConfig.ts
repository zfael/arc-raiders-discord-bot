import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

const DATA_DIR = path.join(__dirname, '../data');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');

export interface ServerConfig {
  [guildId: string]: {
    channelId: string;
  };
}

/**
 * Ensures the data directory exists.
 */
function ensureDataDirExists(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Reads all server configurations from the file.
 * @returns {ServerConfig} The server configurations.
 */
export function getServerConfigs(): ServerConfig {
  ensureDataDirExists();
  try {
    if (fs.existsSync(SERVERS_FILE)) {
      const data = fs.readFileSync(SERVERS_FILE, 'utf8');
      return JSON.parse(data) as ServerConfig;
    }
  } catch (error) {
    logger.error({ err: error }, 'Error reading server configurations');
  }
  return {};
}

/**
 * Adds or updates a server's configuration.
 * @param {string} guildId The ID of the server.
 * @param {string} channelId The ID of the channel to post updates in.
 */
export function setServerConfig(guildId: string, channelId: string): void {
  const configs = getServerConfigs();
  configs[guildId] = { channelId };
  try {
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(configs, null, 2));
  } catch (error) {
    logger.error({ err: error }, 'Error saving server configuration');
  }
}

/**
 * Removes a server's configuration.
 * @param {string} guildId The ID of the server to remove.
 */
export function removeServerConfig(guildId: string): void {
  const configs = getServerConfigs();
  if (configs[guildId]) {
    delete configs[guildId];
    try {
      fs.writeFileSync(SERVERS_FILE, JSON.stringify(configs, null, 2));
    } catch (error) {
      logger.error({ err: error }, 'Error removing server configuration');
    }
  }
}
