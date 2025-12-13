import type { ServerConfig } from "../types";
import { logger } from "./logger";
import { isLocaleAvailable } from "./localeLoader";
import { supabase } from "./supabaseClient";

const SERVERS_TABLE = "servers";

interface ServerRow {
  guild_id: string;
  channel_id: string;
  server_name: string | null;
  message_id: string | null;
  last_updated: string | null;
  mobile_friendly: boolean | null;
  locale: string | null;
  ping_target: string | null;
  ping_role_id: string | null;
  notification_method: string | null;
}

/**
 * Reads all server configurations from Supabase.
 * @returns The server configurations keyed by guildId.
 */
export async function getServerConfigs(): Promise<ServerConfig> {
  try {
    const { data, error } = await supabase
      .from(SERVERS_TABLE)
      .select(
        "guild_id, channel_id, server_name, message_id, last_updated, mobile_friendly, locale, ping_target, ping_role_id, notification_method",
      );

    if (error) {
      throw error;
    }

    if (!data) {
      return {};
    }

    const rows = data as ServerRow[];

    return rows.reduce((acc, row) => {
      acc[row.guild_id] = {
        channelId: row.channel_id,
        serverName: row.server_name ?? undefined,
        messageId: row.message_id ?? undefined,
        lastUpdated: row.last_updated ?? undefined,
        mobileFriendly: row.mobile_friendly ?? false,
        locale: row.locale ?? "en",
        pingTarget: (row.ping_target as "none" | "everyone" | "role" | undefined) ?? undefined,
        pingRoleId: row.ping_role_id ?? undefined,
        notificationMethod:
          (row.notification_method as "pin-edit" | "post-delete" | "post-keep" | undefined) ??
          undefined,
      };
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
  pingTarget?: string | null,
  pingRoleId?: string | null,
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
      ping_target: pingTarget ?? null,
      ping_role_id: pingRoleId ?? null,
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
  } catch (error) {
    logger.error({ err: error }, "Error updating server locale");
    throw error;
  }
}

/**
 * Updates the notification method setting for a server.
 */
export async function setNotificationMethod(
  guildId: string,
  notificationMethod: "pin-edit" | "post-delete" | "post-keep",
): Promise<void> {
  try {
    const { error } = await supabase
      .from(SERVERS_TABLE)
      .update({ notification_method: notificationMethod })
      .eq("guild_id", guildId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error({ err: error }, "Error updating notification method setting");
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
  } catch (error) {
    logger.error({ err: error }, "Error saving server message state to Supabase");
  }
}
