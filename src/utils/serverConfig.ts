import type { NotificationMethod, ServerConfig, ServerConfigEntry } from "../types";
import { logger } from "./logger";
import { isLocaleAvailable } from "./localeLoader";
import { supabase } from "./supabaseClient";

const SERVERS_TABLE = "servers";
const CACHE_TTL_MS = Number(process.env.SERVER_CONFIG_CACHE_TTL_MS ?? 60_000);

interface ServerRow {
  guild_id: string;
  channel_id: string;
  server_name: string | null;
  message_id: string | null;
  last_updated: string | null;
  mobile_friendly: boolean | null;
  locale: string | null;
  notification_method: string | null;
}

interface CacheEntry {
  data: ServerConfigEntry;
  expiresAt: number;
}

const serverConfigCache = new Map<string, CacheEntry>();

function toEntry(row: ServerRow): ServerConfigEntry {
  return {
    channelId: row.channel_id,
    serverName: row.server_name ?? undefined,
    messageId: row.message_id ?? undefined,
    lastUpdated: row.last_updated ?? undefined,
    mobileFriendly: row.mobile_friendly ?? false,
    locale: row.locale ?? "en",
    notificationMethod: (row.notification_method as NotificationMethod) ?? "pin-edit",
  };
}

function cacheConfig(guildId: string, entry: ServerConfigEntry): void {
  serverConfigCache.set(guildId, { data: entry, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateServerConfigCache(guildId?: string): void {
  if (!guildId) {
    serverConfigCache.clear();
    return;
  }
  serverConfigCache.delete(guildId);
}

export async function getServerConfig(guildId: string): Promise<ServerConfigEntry | undefined> {
  const cached = serverConfigCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from(SERVERS_TABLE)
      .select(
        "guild_id, channel_id, server_name, message_id, last_updated, mobile_friendly, locale, notification_method",
      )
      .eq("guild_id", guildId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      serverConfigCache.delete(guildId);
      return undefined;
    }

    const entry = toEntry(data as ServerRow);
    cacheConfig(guildId, entry);
    return entry;
  } catch (error) {
    logger.error({ err: error }, `Error reading server configuration for guild ${guildId}`);
    return undefined;
  }
}

/**
 * Reads all server configurations from Supabase.
 * @param notificationMethods Optional array of notification methods to filter by at SQL level.
 * @returns The server configurations keyed by guildId.
 */
export async function getServerConfigs(notificationMethods?: string[]): Promise<ServerConfig> {
  try {
    let query = supabase
      .from(SERVERS_TABLE)
      .select(
        "guild_id, channel_id, server_name, message_id, last_updated, mobile_friendly, locale, notification_method",
      );

    // Filter by notification methods at SQL level if specified
    if (notificationMethods && notificationMethods.length > 0) {
      query = query.in("notification_method", notificationMethods);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data) {
      return {};
    }

    const rows = data as ServerRow[];

    return rows.reduce((acc, row) => {
      const entry = toEntry(row);
      acc[row.guild_id] = entry;
      cacheConfig(row.guild_id, entry);
      return acc;
    }, {} as ServerConfig);
  } catch (error) {
    logger.error({ err: error }, "Error reading server configurations from Supabase");
    return {};
  }
}

/**
 * Adds or updates a server's configuration.
 */
export async function setServerConfig(
  guildId: string,
  channelId: string,
  serverName?: string,
): Promise<void> {
  try {
    const { data: existingConfig, error: selectError } = await supabase
      .from(SERVERS_TABLE)
      .select("channel_id")
      .eq("guild_id", guildId)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    const channelChanged = existingConfig && existingConfig.channel_id !== channelId;

    const payload: Record<string, string | null | boolean> = {
      guild_id: guildId,
      channel_id: channelId,
      server_name: serverName ?? null,
    };

    if (channelChanged) {
      payload.message_id = null;
      payload.last_updated = null;
    }

    const { error } = await supabase.from(SERVERS_TABLE).upsert(payload, {
      onConflict: "guild_id",
    });

    if (error) {
      throw error;
    }
    invalidateServerConfigCache(guildId);
  } catch (error) {
    logger.error({ err: error }, "Error saving server configuration to Supabase");
  }
}

/**
 * Updates the mobile friendly setting for a server.
 */
export async function setMobileFriendly(guildId: string, enabled: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from(SERVERS_TABLE)
      .update({ mobile_friendly: enabled })
      .eq("guild_id", guildId);

    if (error) {
      throw error;
    }
    invalidateServerConfigCache(guildId);
  } catch (error) {
    logger.error({ err: error }, "Error updating mobile friendly setting");
    throw error;
  }
}

/**
 * Updates the locale setting for a server.
 */
export async function setServerLocale(guildId: string, locale: string): Promise<void> {
  try {
    if (!isLocaleAvailable(locale)) {
      const errorMessage = `Unsupported locale "${locale}" rejected for guild ${guildId}`;
      logger.warn(errorMessage);
      throw new Error(errorMessage);
    }

    const { error } = await supabase
      .from(SERVERS_TABLE)
      .update({ locale: locale })
      .eq("guild_id", guildId);

    if (error) {
      throw error;
    }
    invalidateServerConfigCache(guildId);
  } catch (error) {
    logger.error({ err: error }, "Error updating server locale");
    throw error;
  }
}

/**
 * Updates the notification method for a server.
 */
export async function setNotificationMethod(
  guildId: string,
  method: NotificationMethod,
): Promise<void> {
  try {
    const { error } = await supabase
      .from(SERVERS_TABLE)
      .update({ notification_method: method })
      .eq("guild_id", guildId);

    if (error) {
      throw error;
    }
    invalidateServerConfigCache(guildId);
  } catch (error) {
    logger.error({ err: error }, "Error updating notification method");
    throw error;
  }
}

/**
 * Removes a server's configuration.
 */
export async function removeServerConfig(guildId: string): Promise<void> {
  try {
    const { error } = await supabase.from(SERVERS_TABLE).delete().eq("guild_id", guildId);

    if (error) {
      throw error;
    }
    invalidateServerConfigCache(guildId);
  } catch (error) {
    logger.error({ err: error }, "Error removing server configuration from Supabase");
  }
}

/**
 * Updates the stored message metadata for a server.
 */
export async function setServerMessageState(
  guildId: string,
  messageId: string,
  lastUpdated: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from(SERVERS_TABLE)
      .update({
        message_id: messageId,
        last_updated: lastUpdated,
      })
      .eq("guild_id", guildId);

    if (error) {
      throw error;
    }
    invalidateServerConfigCache(guildId);
  } catch (error) {
    logger.error({ err: error }, "Error saving server message state to Supabase");
  }
}
