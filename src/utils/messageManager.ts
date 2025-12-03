import { Client, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { logger } from './logger';
import {
  getCurrentRotation,
  getNextRotation,
  getNextRotationTimestamp,
  formatCondition,
  CONDITION_COLORS,
} from '../config/mapRotation';
import { getServerConfigs, setServerMessageState } from './serverConfig';

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
    .setTitle('🗺️ Arc Raiders - Map Rotation Status')
    .setDescription(
      `**Current Conditions** (UTC Hour: ${current.hour}:00)\nNext rotation: <t:${nextTimestamp}:R>`
    )
    .setColor(primaryColor)
    .addFields(
      // Current Conditions Section
      {
        name: '━━━━━━ 📍 CURRENT CONDITIONS ━━━━━━',
        value: '\u200B', // Invisible character for spacing
        inline: false,
      },
      {
        name: '🏔️ Dam',
        value: `Minor: ${formatCondition(current.damMinor)}\nMajor: ${formatCondition(current.damMajor)}`,
        inline: true,
      },
      {
        name: '🏛️ Buried City',
        value: `Minor: ${formatCondition(current.buriedCityMinor)}\nMajor: ${formatCondition(current.buriedCityMajor)}`,
        inline: true,
      },
      {
        name: '🚀 Spaceport',
        value: `Minor: ${formatCondition(current.spaceportMinor)}\nMajor: ${formatCondition(current.spaceportMajor)}`,
        inline: true,
      },
      {
        name: '🌉 Blue Gate',
        value: `Minor: ${formatCondition(current.blueGateMinor)}\nMajor: ${formatCondition(current.blueGateMajor)}`,
        inline: true,
      },
      {
        name: '🏔️ Stella Montis',
        value: `Minor: ${formatCondition(current.stellaMontisMinor)}\nMajor: ${formatCondition(current.stellaMontisMajor)}`,
        inline: true,
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: true,
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: true,
      },
      // Next Rotation Section
      {
        name: '━━━━━━ ⏭️ NEXT ROTATION ━━━━━━',
        value: '\u200B',
        inline: false,
      },
      {
        name: '🏔️ Dam',
        value: `Minor: ${formatCondition(next.damMinor)}\nMajor: ${formatCondition(next.damMajor)}`,
        inline: true,
      },
      {
        name: '🏛️ Buried City',
        value: `Minor: ${formatCondition(next.buriedCityMinor)}\nMajor: ${formatCondition(next.buriedCityMajor)}`,
        inline: true,
      },
      {
        name: '🚀 Spaceport',
        value: `Minor: ${formatCondition(next.spaceportMinor)}\nMajor: ${formatCondition(next.spaceportMajor)}`,
        inline: true,
      },
      {
        name: '🌉 Blue Gate',
        value: `Minor: ${formatCondition(next.blueGateMinor)}\nMajor: ${formatCondition(next.blueGateMajor)}`,
        inline: true,
      },
      {
        name: '🏔️ Stella Montis',
        value: `Minor: ${formatCondition(next.stellaMontisMinor)}\nMajor: ${formatCondition(next.stellaMontisMajor)}`,
        inline: true,
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: true,
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: true,
      }
    )
    .setTimestamp()
    .setFooter({ text: 'Arc Raiders Bot • Updates every hour' });

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
  existingMessageId?: string
): Promise<void> {
  try {
    const channel = (await client.channels.fetch(channelId)) as TextChannel;

    if (!channel || !channel.isTextBased()) {
      logger.warn(`Invalid or non-text channel: ${channelId}`);
      return;
    }

    const embed = createMapRotationEmbed();
    let message: Message;


    // This logic seems a bit flawed.
    if (existingMessageId) {
      try {
        message = await channel.messages.fetch(existingMessageId);
        await message.edit({ embeds: [embed] });
        // Removing due to unnecessary spam.
      } catch (error) {
        logger.warn(`Message not found in ${channelId}, creating a new one.`);
        message = await channel.send({ embeds: [embed] });
        await message.pin();
        logger.info(`Created and pinned a new message in ${channelId}`);
      }
    } else {
      message = await channel.send({ embeds: [embed] });
      await message.pin();
      logger.info(`Created and pinned a new message in ${channelId}`);
    }

    await setServerMessageState(guildId, message.id, new Date().toISOString());
  } catch (error) {
    logger.error({ err: error }, `Error processing channel ${channelId}`);
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
    logger.info('No servers configured for updates.');
    return;
  }

  for (const [guildId, config] of entries) {
    await postOrUpdateInChannel(client, guildId, config.channelId, config.messageId);
  }
}