import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  DiscordAPIError,
  EmbedBuilder,
  type Message,
  type TextChannel,
} from "discord.js";
import {
  CONDITION_COLORS,
  CONDITION_EMOJIS,
  getCurrentRotation,
  getNextRotationTimestamp,
  MAP_ROTATIONS,
} from "../config/mapRotation";
import type { MapRotation, ServerConfigEntry } from "../types";
import { getT, translateEvent } from "./i18n";
import { generateMapImage, resolveImageLocale } from "./imageGenerator";
import { interactionLockManager } from "./interactionLock";
import { logger } from "./logger";
import { getServerConfig, getServerConfigs, setServerMessageState } from "./serverConfig";

const MAP_IMAGE_FILENAME = "map-status.png";
// CDN URLs expire after some time, so we cache with TTL (30 minutes is safe for Discord CDN)
const CDN_CACHE_TTL_MS = 30 * 60 * 1000;
// Discord embed limits
const MAX_EMBED_FIELDS = 25;
interface CachedImageUrl {
  url: string;
  cachedAt: number;
}
const imageUrlCache = new Map<string, CachedImageUrl>();
let cachedImageHour: number | null = null;
const verboseMessageLogging = process.env.VERBOSE_MESSAGE_LOGS === "true";

interface MapImageCacheContext {
  resolvedLocale: string;
  rotation: MapRotation;
  cacheKey: string;
  cachedUrl?: string;
}

interface CreateMapRotationEmbedOptions {
  rotation?: MapRotation;
  imageUrl?: string;
}

/**
 * Safely adds fields to an embed, respecting the Discord limit of 25 fields.
 * Logs a warning if fields are truncated.
 */
function safeAddFields(
  embed: EmbedBuilder,
  fields: Array<{ name: string; value: string; inline?: boolean }>,
): void {
  const currentFieldCount = embed.data.fields?.length ?? 0;
  const availableSlots = MAX_EMBED_FIELDS - currentFieldCount;

  if (fields.length > availableSlots) {
    logger.warn(
      { requested: fields.length, available: availableSlots, current: currentFieldCount },
      "Embed field limit reached - truncating fields",
    );
    embed.addFields(...fields.slice(0, availableSlots));
  } else {
    embed.addFields(...fields);
  }
}

/**
 * Create the map rotation embed
 */
export async function createMapRotationEmbed(
  mobileFriendly: boolean = false,
  locale: string = "en",
  options?: CreateMapRotationEmbedOptions,
): Promise<{
  embed: EmbedBuilder;
  files: AttachmentBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const t = getT(locale);
  const current = options?.rotation ?? getCurrentRotation();
  const nextTimestamp = getNextRotationTimestamp();

  const primaryColor =
    CONDITION_COLORS[current.damMajor] || CONDITION_COLORS[current.damMinor] || 0x5865f2;

  const embed = new EmbedBuilder()
    .setTitle(t("map_rotation.title"))
    .setDescription(
      `**${t("map_rotation.forecast.conditions")}**\n${t("map_rotation.forecast.next_rotation", { timestamp: nextTimestamp })}`,
    )
    .setColor(primaryColor);

  const files: AttachmentBuilder[] = [];
  if (options?.imageUrl) {
    embed.setImage(options.imageUrl);
    logVerbose(
      { locale, source: "cdn-cache", imageUrl: options.imageUrl },
      "Reusing cached CDN map image",
    );
  } else {
    const mapBuffer = await generateMapImage(current, locale);
    const mapAttachment = new AttachmentBuilder(mapBuffer, {
      name: MAP_IMAGE_FILENAME,
    });
    embed.setImage(`attachment://${MAP_IMAGE_FILENAME}`);
    files.push(mapAttachment);
    logVerbose({ locale, source: "attachment" }, "Uploading fresh map image");
  }

  // Helper to format location events with translation
  const formatLocationEventsTranslated = (major: string, minor: string) => {
    const parts = [];
    if (major !== "None") {
      parts.push(`${CONDITION_EMOJIS[major]} **${translateEvent(t, major)}**`);
    }
    if (minor !== "None") {
      parts.push(`${CONDITION_EMOJIS[minor]} ${translateEvent(t, minor)}`);
    }
    return parts.length > 0 ? parts.join("\n") : t("map_rotation.events.none");
  };

  // Location Layout
  if (mobileFriendly) {
    // Mobile: Vertical list (non-inline fields)
    safeAddFields(embed, [
      {
        name: `🏔️ ${t("map_rotation.locations_short.dam")}`,
        value: formatLocationEventsTranslated(current.damMajor, current.damMinor),
        inline: false,
      },
      {
        name: `🏛️ ${t("map_rotation.locations.buried_city")}`,
        value: formatLocationEventsTranslated(current.buriedCityMajor, current.buriedCityMinor),
        inline: false,
      },
      {
        name: `🚀 ${t("map_rotation.locations.spaceport")}`,
        value: formatLocationEventsTranslated(current.spaceportMajor, current.spaceportMinor),
        inline: false,
      },
      {
        name: `🌉 ${t("map_rotation.locations.blue_gate")}`,
        value: formatLocationEventsTranslated(current.blueGateMajor, current.blueGateMinor),
        inline: false,
      },
      {
        name: `🏔️ ${t("map_rotation.locations.stella_montis")}`,
        value: formatLocationEventsTranslated(current.stellaMontisMajor, current.stellaMontisMinor),
        inline: false,
      },
    ]);
  } else {
    // Desktop: Grid (inline fields)
    safeAddFields(embed, [
      {
        name: `🏔️ ${t("map_rotation.locations_short.dam")}`,
        value: formatLocationEventsTranslated(current.damMajor, current.damMinor),
        inline: true,
      },
      {
        name: `🏛️ ${t("map_rotation.locations.buried_city")}`,
        value: formatLocationEventsTranslated(current.buriedCityMajor, current.buriedCityMinor),
        inline: true,
      },
      {
        name: `🚀 ${t("map_rotation.locations.spaceport")}`,
        value: formatLocationEventsTranslated(current.spaceportMajor, current.spaceportMinor),
        inline: true,
      },
      {
        name: `🌉 ${t("map_rotation.locations.blue_gate")}`,
        value: formatLocationEventsTranslated(current.blueGateMajor, current.blueGateMinor),
        inline: true,
      },
      { name: "\u200b", value: "\u200b", inline: true },
      {
        name: `🏔️ ${t("map_rotation.locations.stella_montis")}`,
        value: formatLocationEventsTranslated(current.stellaMontisMajor, current.stellaMontisMinor),
        inline: true,
      },
    ]);
  }

  // Forecast Layout
  const currentHour = current.hour;

  if (mobileFriendly) {
    // Mobile: List in Description/Value
    let forecastText = "";
    for (let i = 1; i <= 6; i++) {
      const hourIndex = (currentHour + i) % 24;
      const rotation = MAP_ROTATIONS[hourIndex];
      const timestamp = nextTimestamp + (i - 1) * 3600;
      const timeLabel = `<t:${timestamp}:R>`;

      const events = [];
      if (rotation.damMajor !== "None")
        events.push(
          `${t("map_rotation.locations_short.dam")}: ${CONDITION_EMOJIS[rotation.damMajor]}`,
        );
      if (rotation.buriedCityMajor !== "None")
        events.push(
          `${t("map_rotation.locations_short.buried_city")}: ${CONDITION_EMOJIS[rotation.buriedCityMajor]}`,
        );
      if (rotation.spaceportMajor !== "None")
        events.push(
          `${t("map_rotation.locations_short.spaceport")}: ${CONDITION_EMOJIS[rotation.spaceportMajor]}`,
        );
      if (rotation.blueGateMajor !== "None")
        events.push(
          `${t("map_rotation.locations_short.blue_gate")}: ${CONDITION_EMOJIS[rotation.blueGateMajor]}`,
        );
      if (rotation.stellaMontisMajor !== "None")
        events.push(
          `${t("map_rotation.locations_short.stella_montis")}: ${CONDITION_EMOJIS[rotation.stellaMontisMajor]}`,
        );

      if (events.length > 0) {
        forecastText += `**${timeLabel}**\n${events.join("\n")}\n`;
      } else {
        forecastText += `**${timeLabel}**\n${t("map_rotation.forecast.no_major_events")}\n`;
      }
    }

    safeAddFields(embed, [
      {
        name: t("map_rotation.forecast.header"),
        value: forecastText || t("map_rotation.forecast.no_events"),
        inline: false,
      },
    ]);
  } else {
    // Desktop: Inline Fields
    safeAddFields(embed, [
      {
        name: t("map_rotation.forecast.header"),
        value: "\u200b",
        inline: false,
      },
    ]);

    let timeCol = "";
    let conditionCol = "";

    for (let i = 1; i <= 6; i++) {
      const hourIndex = (currentHour + i) % 24;
      const rotation = MAP_ROTATIONS[hourIndex];
      const timestamp = nextTimestamp + (i - 1) * 3600;
      const timeLabel = `<t:${timestamp}:R>`;

      const events = [];
      if (rotation.damMajor !== "None")
        events.push(
          `${t("map_rotation.locations_short.dam")}: ${CONDITION_EMOJIS[rotation.damMajor]}`,
        );
      if (rotation.buriedCityMajor !== "None")
        events.push(
          `${t("map_rotation.locations_short.buried_city")}: ${CONDITION_EMOJIS[rotation.buriedCityMajor]}`,
        );
      if (rotation.spaceportMajor !== "None")
        events.push(
          `${t("map_rotation.locations_short.spaceport")}: ${CONDITION_EMOJIS[rotation.spaceportMajor]}`,
        );
      if (rotation.blueGateMajor !== "None")
        events.push(
          `${t("map_rotation.locations_short.blue_gate")}: ${CONDITION_EMOJIS[rotation.blueGateMajor]}`,
        );
      if (rotation.stellaMontisMajor !== "None")
        events.push(
          `${t("map_rotation.locations_short.stella_montis")}: ${CONDITION_EMOJIS[rotation.stellaMontisMajor]}`,
        );

      const eventText =
        events.length > 0 ? events.join("\n") : t("map_rotation.forecast.no_major_events");

      const lineCount = events.length > 0 ? events.length : 1;
      timeCol += `${timeLabel}`;
      for (let j = 1; j < lineCount; j++) {
        timeCol += "\n\u200b";
      }
      timeCol += "\n";

      conditionCol += `${eventText}\n`;
    }

    safeAddFields(embed, [
      { name: t("map_rotation.forecast.time_until"), value: timeCol, inline: true },
      { name: t("map_rotation.forecast.conditions"), value: conditionCol, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
    ]);
  }

  embed.setTimestamp().setFooter({ text: t("map_rotation.footer") });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("view_map_dam")
      .setLabel(t("map_rotation.buttons.dam"))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏔️"),
    new ButtonBuilder()
      .setCustomId("view_map_buriedCity")
      .setLabel(t("map_rotation.buttons.buried_city"))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏛️"),
    new ButtonBuilder()
      .setCustomId("view_map_spaceport")
      .setLabel(t("map_rotation.buttons.spaceport"))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🚀"),
    new ButtonBuilder()
      .setCustomId("view_map_blueGate")
      .setLabel(t("map_rotation.buttons.blue_gate"))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🌉"),
    new ButtonBuilder()
      .setCustomId("view_map_stellaMontis")
      .setLabel(t("map_rotation.buttons.stella_montis"))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏔️"),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("view_mode_major")
      .setLabel(t("map_rotation.buttons.show_major"))
      .setStyle(ButtonStyle.Primary)
      .setEmoji("⚔️"),
    new ButtonBuilder()
      .setCustomId("view_mode_minor")
      .setLabel(t("map_rotation.buttons.show_minor"))
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🔍"),
    new ButtonBuilder()
      .setCustomId("view_overview")
      .setLabel(t("map_rotation.buttons.home"))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏠")
      .setDisabled(true),
  );

  return { embed, files, components: [row1, row2] };
}

/**
 * Options for posting or updating a map rotation message
 */
export interface PostOrUpdateOptions {
  existingMessageId?: string;
  localeOverride?: string;
  configOverride?: ServerConfigEntry;
}

/**
 * Post or update the map rotation message in a specific channel.
 * @param {Client} client The Discord client.
 * @param guildId The guild that owns the channel.
 * @param channelId The ID of the channel to post in.
 * @param options Optional configuration for the update.
 */
export async function postOrUpdateInChannel(
  client: Client,
  guildId: string,
  channelId: string,
  options: PostOrUpdateOptions = {},
): Promise<void> {
  const { existingMessageId, localeOverride, configOverride } = options;
  try {
    // Try to resolve from cache first, then fetch if missing
    let channel = client.channels.resolve(channelId) as TextChannel;
    if (!channel) {
      channel = (await client.channels.fetch(channelId)) as TextChannel;
    }

    if (!channel || !channel.isTextBased()) {
      logger.warn(`Invalid or non-text channel: ${channelId}`);
      return;
    }
    logVerbose({ guildId, channelId }, "Resolved text channel for update");

    const config = configOverride ?? (await getServerConfig(guildId));
    const mobileFriendly = config?.mobileFriendly ?? false;
    const notificationMethod = config?.notificationMethod ?? "pin-edit";
    // Use override if provided, otherwise fetch from config
    const locale = localeOverride || config?.locale || channel.guild?.preferredLocale || "en";
    logVerbose(
      { guildId, channelId, notificationMethod, locale, mobileFriendly },
      "Loaded server configuration for update",
    );

    const imageContext = prepareImageCacheContext(locale);
    const { embed, files, components } = await createMapRotationEmbed(mobileFriendly, locale, {
      rotation: imageContext.rotation,
      imageUrl: imageContext.cachedUrl,
    });
    let message: Message;
    const payload = {
      embeds: [embed],
      components,
      files: files.length > 0 ? files : undefined,
    };
    const logOperationResult = (action: string, startedAt: number) => {
      logger.info(
        {
          guildId,
          channelId,
          notificationMethod,
          durationMs: Date.now() - startedAt,
          cachedImage: Boolean(imageContext.cachedUrl),
        },
        action,
      );
    };

    // Handle different notification methods
    if (notificationMethod === "pin-edit") {
      // Option 1: Pin and Edit (current behavior)
      if (
        existingMessageId != null &&
        typeof existingMessageId === "string" &&
        existingMessageId.trim() !== ""
      ) {
        try {
          logVerbose(
            { guildId, channelId, existingMessageId },
            "Attempting to edit existing pinned message",
          );
          const opStart = Date.now();
          message = await channel.messages.edit(existingMessageId, payload);
          logOperationResult(`Updated pinned message in ${channelId}`, opStart);
        } catch (error) {
          logger.warn(
            {
              guildId,
              channelId,
              existingMessageId,
              error: formatDiscordError(error),
            },
            `Message not found in ${channelId}, creating a new one.`,
          );
          const opStart = Date.now();
          message = await channel.send(payload);
          await message.pin().catch(catchPinError);
          logOperationResult(`Created and pinned a new message in ${channelId}`, opStart);
        }
      } else {
        const opStart = Date.now();
        message = await channel.send(payload);
        await message.pin().catch(catchPinError);
        logOperationResult(`Created and pinned a new message in ${channelId}`, opStart);
      }
      await setServerMessageState(guildId, message.id, new Date().toISOString());
    } else if (notificationMethod === "post-delete") {
      // Option 2: Post new and delete old
      if (
        existingMessageId != null &&
        typeof existingMessageId === "string" &&
        existingMessageId.trim() !== ""
      ) {
        try {
          logVerbose(
            { guildId, channelId, existingMessageId },
            "Attempting to delete previous message before posting new one",
          );
          await channel.messages.delete(existingMessageId);
        } catch (_error) {
          logger.warn(`Old message ${existingMessageId} not found, skipping deletion`);
        }
      }

      const opStart = Date.now();
      message = await channel.send(payload);
      logOperationResult(`Posted new message in ${channelId} (post-delete mode)`, opStart);
      await setServerMessageState(guildId, message.id, new Date().toISOString());
    } else if (notificationMethod === "post-keep") {
      // Option 3: Post new and keep history
      const opStart = Date.now();
      message = await channel.send(payload);
      logOperationResult(`Posted new message in ${channelId} (post-keep mode)`, opStart);
      // Don't store message ID for post-keep mode, or set to null
      await setServerMessageState(guildId, message.id, new Date().toISOString());
    }

    if (!imageContext.cachedUrl && message) {
      cacheImageUrlFromMessage(message, imageContext.cacheKey);
    }
  } catch (error) {
    logger.error(
      {
        guildId,
        channelId,
        error: formatDiscordError(error),
      },
      `Error processing channel ${channelId}`,
    );
  }
}

/**
 * Iterates through all configured servers and updates their map rotation messages.
 * Uses a queue-based approach with concurrent workers for optimal performance.
 * @param {Client} client The Discord client.
 * @param {string[]} filterByNotificationMethod Optional array of notification methods to filter by.
 */
export async function postOrUpdateMapMessages(
  client: Client,
  filterByNotificationMethod?: string[],
): Promise<void> {
  const start = Date.now();
  const serverConfigs = await getServerConfigs(filterByNotificationMethod);

  // Filter by TEST_GUILD_ID if configured (for local testing)
  const testGuildId = process.env.TEST_GUILD_ID;
  const entries = testGuildId
    ? Object.entries(serverConfigs).filter(([guildId]) => guildId === testGuildId)
    : Object.entries(serverConfigs);

  if (testGuildId) {
    logger.info(`TEST_GUILD_ID detected: filtering to guild ${testGuildId} only`);
  }

  if (entries.length === 0) {
    logger.info(
      testGuildId
        ? `No configuration found for test guild ${testGuildId}.`
        : "No servers configured for updates.",
    );
    return;
  }

  // Queue-based processing with configurable concurrency
  const CONCURRENT_WORKERS = Number(process.env.MESSAGE_PROCESSING_WORKERS) || 5;
  logger.info(
    `Starting update for ${entries.length} servers with ${CONCURRENT_WORKERS} concurrent workers...`,
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
      if (currentIndex >= entries.length) break;

      const [guildId, config] = entries[currentIndex];

      try {
        if (!config?.channelId) {
          logger.warn({ guildId }, "Skipping server without configured channel");
          continue;
        }
        logVerbose(
          {
            workerId,
            guildId,
            channelId: config.channelId,
            notificationMethod: config.notificationMethod,
          },
          "Worker picked server for processing",
        );
        await postOrUpdateInChannel(client, guildId, config.channelId, {
          existingMessageId: config.messageId,
          configOverride: config,
        });
        context.processed++;

        if (context.processed % 10 === 0) {
          logger.info(`Progress: ${context.processed}/${entries.length} servers processed`);
        }
      } catch (error) {
        context.errors++;
        logger.error(
          { guildId, channelId: config.channelId, error },
          `Worker ${workerId}: Failed to process server`,
        );
      }
    }
  };

  // Start concurrent workers
  const workers: Promise<void>[] = [];
  for (let i = 0; i < CONCURRENT_WORKERS; i++) {
    workers.push(worker(i + 1));
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  const duration = Date.now() - start;
  logger.info(
    `All updates completed in ${duration}ms (${context.processed} successful, ${context.errors} errors, avg ${Math.round(duration / entries.length)}ms per server)`,
  );
}

const catchPinError = (error: unknown) => {
  logger.error({ error }, "Error pinning message");
};

/**
 * Sets up the lock expiration callback to revert messages to the home screen.
 * @param client The Discord client.
 */
export function setupLockExpiration(client: Client) {
  interactionLockManager.setExpirationCallback(async (messageId, channelId, guildId) => {
    try {
      const channel = (await client.channels.fetch(channelId)) as TextChannel;
      if (!channel || !channel.isTextBased()) return;

      const message = await channel.messages.fetch(messageId);
      if (!message) return;

      // Check if already on home screen (Home button disabled)
      const existingComponents = message.components;
      let isHome = false;

      // Check row 2 (index 1) for Home button (index 2)
      if (existingComponents.length > 1) {
        const row2 = existingComponents[1] as any;
        const homeButton = row2.components.find((c: any) => c.customId === "view_overview");
        if (homeButton?.disabled) {
          isHome = true;
        }
      }

      if (!isHome) {
        // Get config for mobile friendly
        const config = await getServerConfig(guildId);
        const mobileFriendly = config?.mobileFriendly ?? false;
        const locale = config?.locale || channel.guild?.preferredLocale || "en";
        logVerbose(
          { guildId, channelId, messageId },
          "Lock expired: restoring message to overview state",
        );

        const imageContext = prepareImageCacheContext(locale);
        const { embed, files, components } = await createMapRotationEmbed(mobileFriendly, locale, {
          rotation: imageContext.rotation,
          imageUrl: imageContext.cachedUrl,
        });
        const updatedMessage = await message.edit({
          embeds: [embed],
          files: files.length > 0 ? files : undefined,
          components: components,
        });
        if (!imageContext.cachedUrl) {
          cacheImageUrlFromMessage(updatedMessage, imageContext.cacheKey);
        }
      }
    } catch (error) {
      logVerbose(
        { guildId, channelId, messageId, error: formatDiscordError(error) },
        "Lock expiration reset skipped (message missing or deleted)",
      );
    }
  });
}

function prepareImageCacheContext(locale: string): MapImageCacheContext {
  const rotation = getCurrentRotation();
  const now = Date.now();

  if (cachedImageHour === null || cachedImageHour !== rotation.hour) {
    cachedImageHour = rotation.hour;
    imageUrlCache.clear();
    logVerbose({ newHour: rotation.hour }, "Cleared image CDN cache due to hour change");
  }

  const resolvedLocale = resolveImageLocale(locale);
  const cacheKey = `${resolvedLocale}-${rotation.hour}`;

  // Check if cached URL exists and hasn't expired
  const cached = imageUrlCache.get(cacheKey);
  let cachedUrl: string | undefined;
  if (cached && now - cached.cachedAt < CDN_CACHE_TTL_MS) {
    cachedUrl = cached.url;
  } else if (cached) {
    // URL expired, remove from cache
    imageUrlCache.delete(cacheKey);
    logVerbose({ cacheKey }, "Removed expired CDN URL from cache");
  }

  return {
    resolvedLocale,
    rotation,
    cacheKey,
    cachedUrl,
  };
}

function cacheImageUrlFromMessage(message: Message, cacheKey: string): void {
  if (!cacheKey || !message?.attachments?.size) {
    logVerbose({ cacheKey }, "Skipping CDN cache update because attachment list is empty");
    return;
  }

  const attachment =
    message.attachments.find((att) => att.name === MAP_IMAGE_FILENAME) ??
    message.attachments.find((att) => att.contentType?.startsWith("image/"));

  if (attachment?.url) {
    imageUrlCache.set(cacheKey, { url: attachment.url, cachedAt: Date.now() });
    logVerbose({ cacheKey, url: attachment.url }, "Cached CDN attachment URL for reuse");
  }
}

function logVerbose(metadata: Record<string, unknown>, message: string): void {
  if (verboseMessageLogging) {
    logger.debug(metadata, message);
  }
}

function formatDiscordError(error: unknown): Record<string, unknown> {
  if (!error) return {};
  if (error instanceof DiscordAPIError) {
    return {
      name: error.name,
      code: error.code,
      status: error.status,
      method: error.method,
      url: error.url,
      message: error.message,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: verboseMessageLogging ? error.stack : undefined,
    };
  }

  return { error };
}
