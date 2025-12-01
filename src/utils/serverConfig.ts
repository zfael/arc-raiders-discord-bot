import type { ServerConfig } from "../types";
import { logger } from "./logger";
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
        "guild_id, channel_id, server_name, message_id, last_updated, mobile_friendly, locale",
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
