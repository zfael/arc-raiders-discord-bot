import type { NotificationMethod, ServerConfig, ServerConfigEntry } from "../../types";
import { logger } from "../logger";
import { isLocaleAvailable } from "../i18n/localeLoader";
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
 * @throws Error if the database operation fails
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
    throw error;
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
 * @throws Error if the database operation fails
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
    throw error;
  }
}

/**
 * Removes multiple server configurations in batch.
 * Used during startup validation to clean up dead guilds/channels.
 * @param guildIds Array of guild IDs to remove
 */
export async function removeServerConfigs(guildIds: string[]): Promise<void> {
  if (guildIds.length === 0) return;

  try {
    const { error } = await supabase.from(SERVERS_TABLE).delete().in("guild_id", guildIds);

    if (error) {
      throw error;
    }

    // Invalidate cache for all removed guilds
    for (const guildId of guildIds) {
      invalidateServerConfigCache(guildId);
    }

    logger.info({ count: guildIds.length }, "Batch removed server configurations");
  } catch (error) {
    logger.error(
      { err: error, guildIds },
      "Error batch removing server configurations from Supabase",
    );
    throw error;
  }
}

/**
 * Clears message IDs for multiple servers in batch.
 * Used during startup validation when messages are detected as deleted.
 * @param guildIds Array of guild IDs to clear message IDs for
 */
export async function clearMessageIds(guildIds: string[]): Promise<void> {
  if (guildIds.length === 0) return;

  try {
    const { error } = await supabase
      .from(SERVERS_TABLE)
      .update({ message_id: null })
      .in("guild_id", guildIds);

    if (error) {
      throw error;
    }

    // Invalidate cache for all updated guilds
    for (const guildId of guildIds) {
      invalidateServerConfigCache(guildId);
    }

    logger.info({ count: guildIds.length }, "Batch cleared message IDs");
  } catch (error) {
    logger.error({ err: error, guildIds }, "Error batch clearing message IDs in Supabase");
    throw error;
  }
}

/**
 * Updates the stored message metadata for a server.
 * @throws Error if the database operation fails
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
    throw error;
  }
}

/**
 * Pending message state update for batch processing
 */
export interface PendingMessageUpdate {
  guildId: string;
  messageId: string;
  lastUpdated: string;
}

/**
 * Batch updates message states for multiple servers using individual UPDATE queries.
 * Supabase doesn't support true batch UPDATE, so we run them in parallel for efficiency.
 * @param updates Array of pending message updates
 */
export async function batchSetServerMessageStates(updates: PendingMessageUpdate[]): Promise<void> {
  if (updates.length === 0) return;

  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  try {
    // Run all updates in parallel for efficiency
    const results = await Promise.allSettled(
      updates.map(async (update) => {
        const { error } = await supabase
          .from(SERVERS_TABLE)
          .update({
            message_id: update.messageId,
            last_updated: update.lastUpdated,
          })
          .eq("guild_id", update.guildId);

        if (error) {
          throw error;
        }

        invalidateServerConfigCache(update.guildId);
        return update.guildId;
      }),
    );

    // Count successes and failures
    for (const result of results) {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        errorCount++;
        logger.warn({ error: result.reason }, "Individual batch update failed");
      }
    }

    logger.info(
      {
        total: updates.length,
        success: successCount,
        errors: errorCount,
        durationMs: Date.now() - startTime,
      },
      "Batch updated server message states",
    );

    // If all failed, throw to trigger fallback
    if (successCount === 0 && errorCount > 0) {
      throw new Error(`All ${errorCount} batch updates failed`);
    }
  } catch (error) {
    logger.error(
      { err: error, count: updates.length },
      "Error batch updating server message states in Supabase",
    );
    throw error;
  }
}
