import { type Client, type TextChannel, DiscordAPIError, PermissionFlagsBits } from "discord.js";
import type { ValidatedServerEntry, ValidationResult, ValidationStatus } from "../types";
import { logger } from "./logger";
import { getServerConfigs, removeServerConfigs, clearMessageIds } from "./serverConfig";
import { postOrUpdateInChannel } from "./messageManager";

/**
 * Discord API error codes for validation
 */
const DISCORD_ERROR_CODES = {
  UNKNOWN_MESSAGE: 10008,
  UNKNOWN_CHANNEL: 10003,
  MISSING_ACCESS: 50001,
  MISSING_PERMISSIONS: 50013,
} as const;

/**
 * Required permissions for the bot to operate in a channel
 */
const REQUIRED_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
];

/**
 * Checks if the bot should update an hourly server based on the last update timestamp.
 * Returns true if the hour has changed since the last update.
 */
export function shouldUpdateHourlyServer(lastUpdated: string | undefined): boolean {
  if (!lastUpdated) return true; // Never updated, should update

  const lastUpdateTime = new Date(lastUpdated);
  const now = new Date();

  // Get hours in UTC
  const lastHour = lastUpdateTime.getUTCHours();
  const currentHour = now.getUTCHours();

  // Also check if it's a different day (handles midnight edge case)
  const lastDate = lastUpdateTime.toISOString().split("T")[0];
  const currentDate = now.toISOString().split("T")[0];

  return lastHour !== currentHour || lastDate !== currentDate;
}

/**
 * Validates if the bot is still a member of the guild
 */
function validateGuild(client: Client, guildId: string): boolean {
  return client.guilds.cache.has(guildId);
}

/**
 * Validates if a channel exists and the bot has required permissions
 * Returns: { valid: boolean, status: ValidationStatus, error?: string }
 */
async function validateChannel(
  client: Client,
  guildId: string,
  channelId: string,
): Promise<{ valid: boolean; status: ValidationStatus; error?: string }> {
  try {
    // Try cache first, then fetch
    let channel = client.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel) {
      channel = ((await client.channels.fetch(channelId)) as TextChannel | null) ?? undefined;
    }

    if (!channel) {
      return { valid: false, status: "dead_channel", error: "Channel not found" };
    }

    if (!channel.isTextBased()) {
      return { valid: false, status: "dead_channel", error: "Channel is not text-based" };
    }

    // Check permissions
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return {
        valid: false,
        status: "dead_guild",
        error: "Guild not found during permission check",
      };
    }

    const botMember = guild.members.cache.get(client.user!.id);
    if (!botMember) {
      return { valid: false, status: "permission_error", error: "Bot member not in cache" };
    }

    const permissions = channel.permissionsFor(botMember);
    if (!permissions) {
      return { valid: false, status: "permission_error", error: "Could not resolve permissions" };
    }

    for (const perm of REQUIRED_PERMISSIONS) {
      if (!permissions.has(perm)) {
        return {
          valid: false,
          status: "permission_error",
          error: `Missing permission: ${perm.toString()}`,
        };
      }
    }

    return { valid: true, status: "valid" };
  } catch (error) {
    if (error instanceof DiscordAPIError) {
      if (error.code === DISCORD_ERROR_CODES.UNKNOWN_CHANNEL) {
        return { valid: false, status: "dead_channel", error: "Unknown channel" };
      }
      if (
        error.code === DISCORD_ERROR_CODES.MISSING_ACCESS ||
        error.code === DISCORD_ERROR_CODES.MISSING_PERMISSIONS
      ) {
        return { valid: false, status: "permission_error", error: error.message };
      }
    }
    return { valid: false, status: "permission_error", error: String(error) };
  }
}

/**
 * Validates if a message still exists in the channel
 */
async function validateMessage(
  client: Client,
  channelId: string,
  messageId: string | undefined,
): Promise<{ valid: boolean; status: ValidationStatus; error?: string }> {
  if (!messageId) {
    // No message ID stored, that's fine
    return { valid: true, status: "valid" };
  }

  try {
    const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel) {
      // Channel validation should have caught this
      return { valid: false, status: "dead_channel", error: "Channel not in cache" };
    }

    await channel.messages.fetch(messageId);
    return { valid: true, status: "valid" };
  } catch (error) {
    if (error instanceof DiscordAPIError) {
      if (error.code === DISCORD_ERROR_CODES.UNKNOWN_MESSAGE) {
        return { valid: false, status: "dead_message", error: "Message not found" };
      }
    }
    // For other errors, assume the message might still exist
    return { valid: true, status: "valid" };
  }
}

/**
 * Runs startup validation on all server configurations.
 * Checks for dead guilds, channels, messages, and permission issues.
 * Cleans up invalid entries from the database.
 */
export async function runStartupValidation(client: Client): Promise<ValidationResult> {
  const startTime = Date.now();
  logger.info("Starting server configuration validation...");

  const result: ValidationResult = {
    valid: [],
    deadGuilds: [],
    deadChannels: [],
    deadMessages: [],
    permissionErrors: [],
  };

  // Fetch all server configs
  const serverConfigs = await getServerConfigs();
  const entries = Object.entries(serverConfigs);

  if (entries.length === 0) {
    logger.info("No server configurations to validate");
    return result;
  }

  logger.info(`Validating ${entries.length} server configuration(s)...`);

  // Process each server config
  for (const [guildId, config] of entries) {
    // Step 1: Validate guild membership
    if (!validateGuild(client, guildId)) {
      result.deadGuilds.push(guildId);
      logger.debug({ guildId }, "Guild marked as dead - bot not a member");
      continue;
    }

    // Step 2: Validate channel exists and permissions
    const channelResult = await validateChannel(client, guildId, config.channelId);
    if (!channelResult.valid) {
      if (channelResult.status === "dead_channel") {
        result.deadChannels.push(guildId);
        logger.debug(
          { guildId, channelId: config.channelId, error: channelResult.error },
          "Channel marked as dead",
        );
      } else if (channelResult.status === "permission_error") {
        result.permissionErrors.push(guildId);
        logger.warn(
          { guildId, channelId: config.channelId, error: channelResult.error },
          "Permission error detected",
        );
      }
      continue;
    }

    // Step 3: Validate message exists (only for pin-edit mode where message ID matters)
    if (config.notificationMethod === "pin-edit" && config.messageId) {
      const messageResult = await validateMessage(client, config.channelId, config.messageId);
      if (messageResult.status === "dead_message") {
        result.deadMessages.push(guildId);
        logger.debug(
          { guildId, messageId: config.messageId },
          "Message marked as dead - server inactive until admin re-runs /set-channel",
        );
        // Dead message = server is inactive, don't process until admin re-configures
        continue;
      }
    }

    // Server passed all validation checks
    result.valid.push({
      guildId,
      config,
      status: "valid",
    });
  }

  // Perform database cleanup
  await performDatabaseCleanup(result);

  const duration = Date.now() - startTime;
  logger.info(
    {
      valid: result.valid.length,
      deadGuilds: result.deadGuilds.length,
      deadChannels: result.deadChannels.length,
      deadMessages: result.deadMessages.length,
      permissionErrors: result.permissionErrors.length,
      durationMs: duration,
    },
    "Startup validation complete",
  );

  return result;
}

/**
 * Performs database cleanup based on validation results
 */
async function performDatabaseCleanup(result: ValidationResult): Promise<void> {
  // Delete dead guilds and dead channels
  const toDelete = [...result.deadGuilds, ...result.deadChannels];
  if (toDelete.length > 0) {
    logger.info({ count: toDelete.length }, "Removing dead server configurations from database");
    await removeServerConfigs(toDelete);
  }

  // Clear message IDs for dead messages
  if (result.deadMessages.length > 0) {
    logger.info({ count: result.deadMessages.length }, "Clearing dead message IDs from database");
    await clearMessageIds(result.deadMessages);
  }
}

/**
 * Processes validated servers and updates messages as needed.
 * Uses a concurrent worker pool for optimal performance.
 * Handles hourly notification methods by checking if the hour has changed.
 */
export async function processValidatedServers(
  client: Client,
  validationResult: ValidationResult,
): Promise<void> {
  const { valid } = validationResult;

  if (valid.length === 0) {
    logger.info("No valid servers to process");
    return;
  }

  // Separate by notification method
  const pinEditServers: ValidatedServerEntry[] = [];
  const hourlyServers: ValidatedServerEntry[] = [];

  for (const entry of valid) {
    const method = entry.config.notificationMethod ?? "pin-edit";
    if (method === "pin-edit") {
      pinEditServers.push(entry);
    } else {
      // post-delete or post-keep
      hourlyServers.push(entry);
    }
  }

  // Process hourly servers - only if hour has changed
  const hourlyToUpdate = hourlyServers.filter((entry) =>
    shouldUpdateHourlyServer(entry.config.lastUpdated),
  );

  // Combine all servers to update
  const allToUpdate = [...pinEditServers, ...hourlyToUpdate];

  if (allToUpdate.length === 0) {
    if (hourlyServers.length > 0) {
      logger.info(`Skipping ${hourlyServers.length} hourly server(s) - still within same hour`);
    }
    return;
  }

  // Sort by guild ID to maximize cache hits
  allToUpdate.sort((a, b) => a.guildId.localeCompare(b.guildId));

  const startTime = Date.now();
  const CONCURRENT_WORKERS = Number(process.env.MESSAGE_PROCESSING_WORKERS) || 10;

  logger.info(
    `Processing ${allToUpdate.length} server(s) on startup (${pinEditServers.length} pin-edit, ${hourlyToUpdate.length} hourly) with ${CONCURRENT_WORKERS} workers...`,
  );

  // Context to track processing state
  const context = {
    queueIndex: 0,
    processed: 0,
    errors: 0,
  };

  const worker = async (workerId: number) => {
    while (true) {
      // Atomically get next index and increment
      const currentIndex = context.queueIndex++;

      // Check if we've exhausted the queue
      if (currentIndex >= allToUpdate.length) break;

      const entry = allToUpdate[currentIndex];

      try {
        await postOrUpdateInChannel(client, entry.guildId, entry.config.channelId, {
          existingMessageId: entry.config.messageId,
          configOverride: entry.config,
        });
        context.processed++;
      } catch (error) {
        context.errors++;
        logger.error(
          { guildId: entry.guildId, error, workerId },
          "Failed to update server on startup",
        );
      }
    }
  };

  // Start concurrent workers
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(CONCURRENT_WORKERS, allToUpdate.length); i++) {
    workers.push(worker(i + 1));
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  const duration = Date.now() - startTime;
  logger.info(
    {
      processed: context.processed,
      errors: context.errors,
      durationMs: duration,
      avgMs: Math.round(duration / allToUpdate.length),
    },
    "Startup server processing complete",
  );

  if (hourlyServers.length > hourlyToUpdate.length) {
    logger.info(
      `Skipped ${hourlyServers.length - hourlyToUpdate.length} hourly server(s) - still within same hour`,
    );
  }
}
