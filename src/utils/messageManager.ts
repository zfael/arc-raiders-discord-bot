import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
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
import { getT } from "./i18n";
import { generateMapImage } from "./imageGenerator";
import { interactionLockManager } from "./interactionLock";
import { logger } from "./logger";
import { getServerConfigs, setServerMessageState } from "./serverConfig";

/**
 * Create the map rotation embed
 */
export async function createMapRotationEmbed(
  mobileFriendly: boolean = false,
  locale: string = "en",
): Promise<{
  embed: EmbedBuilder;
  files: AttachmentBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const t = getT(locale);
  const current = getCurrentRotation();
  const nextTimestamp = getNextRotationTimestamp();

  const mapBuffer = await generateMapImage(current, locale);
  const mapAttachment = new AttachmentBuilder(mapBuffer, {
    name: "map-status.png",
  });

  const primaryColor =
    CONDITION_COLORS[current.damMajor] || CONDITION_COLORS[current.damMinor] || 0x5865f2;

  const embed = new EmbedBuilder()
    .setTitle(t("map_rotation.title"))
    .setDescription(
      `**${t("map_rotation.forecast.conditions")}**\n${t("map_rotation.forecast.next_rotation", { timestamp: nextTimestamp })}`,
    )
    .setColor(primaryColor)
    .setImage("attachment://map-status.png");

  // Helper to translate event names (basic mapping)
  const translateEvent = (event: string) => {
    if (event === "None") return t("map_rotation.events.none");
    const key = event.toLowerCase();
    return t(`map_rotation.events.${key}`, { defaultValue: event });
  };

  // Helper to format location events with translation
  const formatLocationEventsTranslated = (major: string, minor: string) => {
    const parts = [];
    if (major !== "None") {
      parts.push(`**${translateEvent(major)}**`);
    }
    if (minor !== "None") {
      parts.push(translateEvent(minor));
    }
    return parts.length > 0 ? parts.join(" | ") : t("map_rotation.events.none");
  };

  // Location Layout
  if (mobileFriendly) {
    // Mobile: Vertical list (non-inline fields)
    embed.addFields(
      {
        name: `🏔️ ${t("map_rotation.locations.dam")}`,
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
    );
  } else {
    // Desktop: Grid (inline fields)
    embed.addFields(
      {
        name: `🏔️ ${t("map_rotation.locations.dam")}`,
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
    );
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
        events.push(`${t("map_rotation.locations.dam")}: ${CONDITION_EMOJIS[rotation.damMajor]}`);
      if (rotation.buriedCityMajor !== "None")
        events.push(
          `${t("map_rotation.locations.buried_city")}: ${CONDITION_EMOJIS[rotation.buriedCityMajor]}`,
        );
      if (rotation.spaceportMajor !== "None")
        events.push(
          `${t("map_rotation.locations.spaceport")}: ${CONDITION_EMOJIS[rotation.spaceportMajor]}`,
        );
      if (rotation.blueGateMajor !== "None")
        events.push(
          `${t("map_rotation.locations.blue_gate")}: ${CONDITION_EMOJIS[rotation.blueGateMajor]}`,
        );
      if (rotation.stellaMontisMajor !== "None")
        events.push(
          `${t("map_rotation.locations.stella_montis")}: ${CONDITION_EMOJIS[rotation.stellaMontisMajor]}`,
        );

      if (events.length > 0) {
        forecastText += `**${timeLabel}** • ${events.join(" | ")}\n`;
      } else {
        forecastText += `**${timeLabel}** • ${t("map_rotation.forecast.no_major_events")}\n`;
      }
    }

    embed.addFields({
      name: t("map_rotation.forecast.header"),
      value: forecastText || t("map_rotation.forecast.no_events"),
      inline: false,
    });
  } else {
    // Desktop: Inline Fields
    embed.addFields({
      name: t("map_rotation.forecast.header"),
      value: "\u200b",
      inline: false,
    });

    let timeCol = "";
    let conditionCol = "";

    for (let i = 1; i <= 6; i++) {
      const hourIndex = (currentHour + i) % 24;
      const rotation = MAP_ROTATIONS[hourIndex];
      const timestamp = nextTimestamp + (i - 1) * 3600;
      const timeLabel = `<t:${timestamp}:R>`;

      const events = [];
      if (rotation.damMajor !== "None")
        events.push(`${t("map_rotation.locations.dam")}: ${CONDITION_EMOJIS[rotation.damMajor]}`);
      if (rotation.buriedCityMajor !== "None")
        events.push(
          `${t("map_rotation.locations.buried_city")}: ${CONDITION_EMOJIS[rotation.buriedCityMajor]}`,
        );
      if (rotation.spaceportMajor !== "None")
        events.push(
          `${t("map_rotation.locations.spaceport")}: ${CONDITION_EMOJIS[rotation.spaceportMajor]}`,
        );
      if (rotation.blueGateMajor !== "None")
        events.push(
          `${t("map_rotation.locations.blue_gate")}: ${CONDITION_EMOJIS[rotation.blueGateMajor]}`,
        );
      if (rotation.stellaMontisMajor !== "None")
        events.push(
          `${t("map_rotation.locations.stella_montis")}: ${CONDITION_EMOJIS[rotation.stellaMontisMajor]}`,
        );

      const eventText =
        events.length > 0 ? events.join(" | ") : t("map_rotation.forecast.no_major_events");

      timeCol += `${timeLabel}\n`;
      conditionCol += `${eventText}\n`;
    }

    embed.addFields(
      { name: t("map_rotation.forecast.time_until"), value: timeCol, inline: true },
      { name: t("map_rotation.forecast.conditions"), value: conditionCol, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
    );
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

  return { embed, files: [mapAttachment], components: [row1, row2] };
}

/**
 * Post or update the map rotation message in a specific channel.
 * @param {Client} client The Discord client.
 * @param guildId The guild that owns the channel.
 * @param channelId The ID of the channel to post in.
 * @param existingMessageId Optional message ID to update instead of creating a new one.
 */
export async function postOrUpdateInChannel(
  client: Client,
  guildId: string,
  channelId: string,
  existingMessageId?: string,
  localeOverride?: string,
): Promise<void> {
  try {
    const channel = (await client.channels.fetch(channelId)) as TextChannel;

    if (!channel || !channel.isTextBased()) {
      logger.warn(`Invalid or non-text channel: ${channelId}`);
      return;
    }

    const configs = await getServerConfigs();
    const config = configs[guildId];
    const mobileFriendly = config?.mobileFriendly ?? false;
    // Use override if provided, otherwise fetch from config
    const locale = localeOverride || config?.locale || channel.guild?.preferredLocale || "en";

    const { embed, files, components } = await createMapRotationEmbed(mobileFriendly, locale);
    let message: Message;

    if (
      existingMessageId != null &&
      typeof existingMessageId === "string" &&
      existingMessageId.trim() !== ""
    ) {
      try {
        message = await channel.messages.fetch(existingMessageId);
        await message.edit({
          embeds: [embed],
          files: files,
          components: components,
        });
      } catch (_error) {
        logger.warn(`Message not found in ${channelId}, creating a new one.`);
        message = await channel.send({
          embeds: [embed],
          files: files,
          components: components,
        });
        await message.pin().catch(catchPinError);
        logger.info(`Created and pinned a new message in ${channelId}`);
      }
    } else {
      message = await channel.send({
        embeds: [embed],
        files: files,
        components: components,
      });
      await message.pin().catch(catchPinError);
      logger.info(`Created and pinned a new message in ${channelId}`);
    }

    await setServerMessageState(guildId, message.id, new Date().toISOString());
  } catch (error) {
    logger.error(
      { type: error?.type, message: error?.message },
      `Error processing channel ${channelId}`,
    );
  }
}

/**
 * Iterates through all configured servers and updates their map rotation messages.
 * @param {Client} client The Discord client.
 */
export async function postOrUpdateMapMessages(client: Client): Promise<void> {
  const serverConfigs = await getServerConfigs();
  const entries = Object.entries(serverConfigs);

  if (entries.length === 0) {
    logger.info("No servers configured for updates.");
    return;
  }

  for (const [guildId, config] of entries) {
    await postOrUpdateInChannel(client, guildId, config.channelId, config.messageId);
  }
}

const catchPinError = (error: any) => {
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
      const components = message.components;
      let isHome = false;

      // Check row 2 (index 1) for Home button (index 2)
      if (components.length > 1) {
        const row2 = components[1] as any;
        const homeButton = row2.components.find((c: any) => c.customId === "view_overview");
        if (homeButton?.disabled) {
          isHome = true;
        }
      }

      if (!isHome) {
        // Get config for mobile friendly
        const configs = await getServerConfigs();
        const config = configs[guildId];
        const mobileFriendly = config?.mobileFriendly ?? false;
        const locale = config?.locale || channel.guild?.preferredLocale || "en";

        const { embed, files, components } = await createMapRotationEmbed(mobileFriendly, locale);
        await message.edit({
          embeds: [embed],
          files: files,
          components: components,
        });
        // logger.info({ messageId }, 'Reverted message to home screen after lock expiration');
      }
    } catch (_error) {
      // logger.error({ err: error }, 'Error reverting message to home screen');
    }
  });
}
