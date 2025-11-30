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
  formatLocationEvents,
  getCurrentRotation,
  getNextRotationTimestamp,
  MAP_ROTATIONS,
} from "../config/mapRotation";
import { generateMapImage } from "./imageGenerator";
import { interactionLockManager } from "./interactionLock";
import { logger } from "./logger";
import { getServerConfigs, setServerMessageState } from "./serverConfig";

/**
 * Create the map rotation embed
 */
export async function createMapRotationEmbed(mobileFriendly: boolean = false): Promise<{
  embed: EmbedBuilder;
  files: AttachmentBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const current = getCurrentRotation();
  const nextTimestamp = getNextRotationTimestamp();

  const mapBuffer = await generateMapImage(current);
  const mapAttachment = new AttachmentBuilder(mapBuffer, {
    name: "map-status.png",
  });

  const primaryColor =
    CONDITION_COLORS[current.damMajor] || CONDITION_COLORS[current.damMinor] || 0x5865f2;

  const embed = new EmbedBuilder()
    .setTitle("🗺️ Arc Raiders - Map Rotation Status")
    .setDescription(`**Current Conditions**\nNext rotation: <t:${nextTimestamp}:R>`)
    .setColor(primaryColor)
    .setImage("attachment://map-status.png");

  // Location Layout
  if (mobileFriendly) {
    // Mobile: Vertical list (non-inline fields)
    embed.addFields(
      {
        name: "🏔️ Dam",
        value: formatLocationEvents(current.damMajor, current.damMinor),
        inline: false,
      },
      {
        name: "🏛️ Buried City",
        value: formatLocationEvents(current.buriedCityMajor, current.buriedCityMinor),
        inline: false,
      },
      {
        name: "🚀 Spaceport",
        value: formatLocationEvents(current.spaceportMajor, current.spaceportMinor),
        inline: false,
      },
      {
        name: "🌉 Blue Gate",
        value: formatLocationEvents(current.blueGateMajor, current.blueGateMinor),
        inline: false,
      },
      {
        name: "🏔️ Stella Montis",
        value: formatLocationEvents(current.stellaMontisMajor, current.stellaMontisMinor),
        inline: false,
      },
    );
  } else {
    // Desktop: Grid (inline fields)
    embed.addFields(
      {
        name: "🏔️ Dam",
        value: formatLocationEvents(current.damMajor, current.damMinor),
        inline: true,
      },
      {
        name: "🏛️ Buried City",
        value: formatLocationEvents(current.buriedCityMajor, current.buriedCityMinor),
        inline: true,
      },
      {
        name: "🚀 Spaceport",
        value: formatLocationEvents(current.spaceportMajor, current.spaceportMinor),
        inline: true,
      },
      {
        name: "🌉 Blue Gate",
        value: formatLocationEvents(current.blueGateMajor, current.blueGateMinor),
        inline: true,
      },
      { name: "\u200b", value: "\u200b", inline: true },
      {
        name: "🏔️ Stella Montis",
        value: formatLocationEvents(current.stellaMontisMajor, current.stellaMontisMinor),
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
      if (rotation.damMajor !== "None") events.push(`Dam: ${CONDITION_EMOJIS[rotation.damMajor]}`);
      if (rotation.buriedCityMajor !== "None")
        events.push(`Buried: ${CONDITION_EMOJIS[rotation.buriedCityMajor]}`);
      if (rotation.spaceportMajor !== "None")
        events.push(`Space: ${CONDITION_EMOJIS[rotation.spaceportMajor]}`);
      if (rotation.blueGateMajor !== "None")
        events.push(`Gate: ${CONDITION_EMOJIS[rotation.blueGateMajor]}`);
      if (rotation.stellaMontisMajor !== "None")
        events.push(`Stella: ${CONDITION_EMOJIS[rotation.stellaMontisMajor]}`);

      if (events.length > 0) {
        forecastText += `**${timeLabel}** • ${events.join(" | ")}\n`;
      } else {
        forecastText += `**${timeLabel}** • No Major Events\n`;
      }
    }

    embed.addFields({
      name: "━━━━━━ 🔮 FORECAST (Next 6 Hours) ━━━━━━",
      value: forecastText || "No major events upcoming.",
      inline: false,
    });
  } else {
    // Desktop: Inline Fields
    embed.addFields({
      name: "━━━━━━ 🔮 FORECAST (Next 6 Hours) ━━━━━━",
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
      if (rotation.damMajor !== "None") events.push(`Dam: ${CONDITION_EMOJIS[rotation.damMajor]}`);
      if (rotation.buriedCityMajor !== "None")
        events.push(`Buried: ${CONDITION_EMOJIS[rotation.buriedCityMajor]}`);
      if (rotation.spaceportMajor !== "None")
        events.push(`Space: ${CONDITION_EMOJIS[rotation.spaceportMajor]}`);
      if (rotation.blueGateMajor !== "None")
        events.push(`Gate: ${CONDITION_EMOJIS[rotation.blueGateMajor]}`);
      if (rotation.stellaMontisMajor !== "None")
        events.push(`Stella: ${CONDITION_EMOJIS[rotation.stellaMontisMajor]}`);

      const eventText = events.length > 0 ? events.join(" | ") : "No Major Events";

      timeCol += `${timeLabel}\n`;
      conditionCol += `${eventText}\n`;
    }

    embed.addFields(
      { name: "Time Until", value: timeCol, inline: true },
      { name: "Conditions", value: conditionCol, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
    );
  }

  embed.setTimestamp().setFooter({ text: "Arc Raiders Bot • Updates every hour" });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("view_map_dam")
      .setLabel("Dam")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏔️"),
    new ButtonBuilder()
      .setCustomId("view_map_buriedCity")
      .setLabel("Buried City")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏛️"),
    new ButtonBuilder()
      .setCustomId("view_map_spaceport")
      .setLabel("Spaceport")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🚀"),
    new ButtonBuilder()
      .setCustomId("view_map_blueGate")
      .setLabel("Blue Gate")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🌉"),
    new ButtonBuilder()
      .setCustomId("view_map_stellaMontis")
      .setLabel("Stella Montis")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏔️"),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("view_mode_major")
      .setLabel("Show Major Events")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("⚔️"),
    new ButtonBuilder()
      .setCustomId("view_mode_minor")
      .setLabel("Show Minor Events")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🔍"),
    new ButtonBuilder()
      .setCustomId("view_overview")
      .setLabel("Home")
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

    const { embed, files, components } = await createMapRotationEmbed(mobileFriendly);
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


  const testGuildId = process.env.TEST_GUILD_ID;
  for (const [guildId, config] of entries) {
    if (testGuildId && guildId !== testGuildId) {
      continue; // Skip non-test guilds if TEST_GUILD_ID is set
    }

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
  interactionLockManager.setExpirationCallback(async (messageId, channelId, _guildId) => {
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
        const { embed, files, components } = await createMapRotationEmbed();
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
