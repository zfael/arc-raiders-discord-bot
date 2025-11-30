import { type Client, EmbedBuilder, type Message, type TextChannel } from "discord.js";
import {
  CONDITION_COLORS,
  formatCondition,
  getCurrentRotation,
  getNextRotation,
  getNextRotationTimestamp,
} from "../config/mapRotation";
import { logger } from "./logger";
import { getServerConfigs, setServerMessageState } from "./serverConfig";

/**
 * Create the map rotation embed
 */
export function createMapRotationEmbed(): EmbedBuilder {
  const current = getCurrentRotation();
  const next = getNextRotation();
  const nextTimestamp = getNextRotationTimestamp();

  // Determine embed color based on most severe current condition
  const primaryColor =
    CONDITION_COLORS[current.damMajor] || CONDITION_COLORS[current.damMinor] || 0x5865f2;

  const embed = new EmbedBuilder()
    .setTitle("🗺️ Arc Raiders - Map Rotation Status")
    .setDescription(
      `**Current Conditions** (UTC Hour: ${current.hour}:00)\nNext rotation: <t:${nextTimestamp}:R>`,
    )
    .setColor(primaryColor)
    .addFields(
      // Current Conditions Section
      {
        name: "━━━━━━ 📍 CURRENT CONDITIONS ━━━━━━",
        value: "\u200B", // Invisible character for spacing
        inline: false,
      },
      {
        name: "🏔️ Dam",
        value: `Minor: ${formatCondition(current.damMinor)}\nMajor: ${formatCondition(current.damMajor)}`,
        inline: true,
      },
      {
        name: "🏛️ Buried City",
        value: `Minor: ${formatCondition(current.buriedCityMinor)}\nMajor: ${formatCondition(current.buriedCityMajor)}`,
        inline: true,
      },
      {
        name: "🚀 Spaceport",
        value: `Minor: ${formatCondition(current.spaceportMinor)}\nMajor: ${formatCondition(current.spaceportMajor)}`,
        inline: true,
      },
      {
        name: "🌉 Blue Gate",
        value: `Minor: ${formatCondition(current.blueGateMinor)}\nMajor: ${formatCondition(current.blueGateMajor)}`,
        inline: true,
      },
      {
        name: "🏔️ Stella Montis",
        value: `Minor: ${formatCondition(current.stellaMontisMinor)}\nMajor: ${formatCondition(current.stellaMontisMajor)}`,
        inline: true,
      },
      {
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
      {
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
      // Next Rotation Section
      {
        name: "━━━━━━ ⏭️ NEXT ROTATION ━━━━━━",
        value: "\u200B",
        inline: false,
      },
      {
        name: "🏔️ Dam",
        value: `Minor: ${formatCondition(next.damMinor)}\nMajor: ${formatCondition(next.damMajor)}`,
        inline: true,
      },
      {
        name: "🏛️ Buried City",
        value: `Minor: ${formatCondition(next.buriedCityMinor)}\nMajor: ${formatCondition(next.buriedCityMajor)}`,
        inline: true,
      },
      {
        name: "🚀 Spaceport",
        value: `Minor: ${formatCondition(next.spaceportMinor)}\nMajor: ${formatCondition(next.spaceportMajor)}`,
        inline: true,
      },
      {
        name: "🌉 Blue Gate",
        value: `Minor: ${formatCondition(next.blueGateMinor)}\nMajor: ${formatCondition(next.blueGateMajor)}`,
        inline: true,
      },
      {
        name: "🏔️ Stella Montis",
        value: `Minor: ${formatCondition(next.stellaMontisMinor)}\nMajor: ${formatCondition(next.stellaMontisMajor)}`,
        inline: true,
      },
      {
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
      {
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter({ text: "Arc Raiders Bot • Updates every hour" });

  return embed;
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

    const embed = createMapRotationEmbed();
    let message: Message;

    // Check explicitly for null/undefined to handle database null values correctly
    if (
      existingMessageId != null &&
      typeof existingMessageId === "string" &&
      existingMessageId.trim() !== ""
    ) {
      try {
        message = await channel.messages.fetch(existingMessageId);
        await message.edit({ embeds: [embed] });
        // Removing due to unnecessary spam.
      } catch {
        logger.warn(`Message not found in ${channelId}, creating a new one.`);
        message = await channel.send({ embeds: [embed] });
        await message.pin().catch(catchPinError);
        logger.info(`Created and pinned a new message in ${channelId}`);
      }
    } else {
      message = await channel.send({ embeds: [embed] });
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

const catchPinError = (error) => {
  logger.error({ error }, "Error pinning message");
};
