import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type Interaction,
} from "discord.js";
import {
  CONDITION_COLORS,
  CONDITION_EMOJIS,
  getCurrentRotation,
  getNextRotationTimestamp,
} from "../config/mapRotation";
import { getT, translateEvent } from "../utils/i18n/i18n";
import { buildForecast } from "../utils/discord/forecastBuilder";
import { interactionLockManager } from "../utils/discord/interactionLock";
import { logger } from "../utils/logger";
import { buildMapRotationMessage } from "../utils/discord/messageManager";
import { getServerConfig } from "../utils/database/serverConfig";

/**
 * Finds and enables the Home button by its customId instead of relying on array index.
 */
function enableHomeButton(rows: ActionRowBuilder<ButtonBuilder>[]): void {
  for (const row of rows) {
    for (const component of row.components) {
      // Access the underlying data to check customId
      // ButtonBuilder data has custom_id for non-link buttons
      const data = component.data as { custom_id?: string };
      if (data.custom_id === "view_overview") {
        component.setDisabled(false);
        return;
      }
    }
  }
}

export async function handleInteraction(interaction: Interaction) {
  if (!interaction.isButton()) return;

  try {
    const { customId, message, user, guildId } = interaction;
    const messageId = message.id;
    const userId = user.id;

    // Attempt to acquire interaction lock atomically
    if (guildId && message.channelId) {
      const acquired = interactionLockManager.acquireLock(
        messageId,
        userId,
        message.channelId,
        guildId,
      );
      if (!acquired) {
        const remaining = interactionLockManager.getRemainingTime(messageId);
        const t = getT(interaction.locale);
        await interaction.reply({
          content: t("map_rotation.locked", { remaining }),
          flags: Number(MessageFlags.Ephemeral),
        });
        return;
      }
    }

    await interaction.deferUpdate();

    // Get Server Config
    const config = guildId ? await getServerConfig(guildId) : null;
    const mobileFriendly = config?.mobileFriendly ?? false;
    const locale = config?.locale || interaction.guild?.preferredLocale || "en";
    const t = getT(locale);

    const current = getCurrentRotation();
    const nextTimestamp = getNextRotationTimestamp();

    const embed = new EmbedBuilder()
      .setTitle(t("map_rotation.title"))
      .setColor(CONDITION_COLORS[current.damMajor] || 0x5865f2)
      .setTimestamp()
      .setFooter({ text: t("map_rotation.footer") });

    const getButtons = (mode: "map" | "major" | "minor") => {
      let row1: ActionRowBuilder<ButtonBuilder>;
      let row2: ActionRowBuilder<ButtonBuilder>;

      if (mode === "map") {
        row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
        row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
      } else if (mode === "major") {
        row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("view_event_Harvester")
            .setLabel(t("map_rotation.events.harvester"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Harvester),
          new ButtonBuilder()
            .setCustomId("view_event_Night")
            .setLabel(t("map_rotation.events.night"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Night),
          new ButtonBuilder()
            .setCustomId("view_event_Storm")
            .setLabel(t("map_rotation.events.storm"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Storm),
          new ButtonBuilder()
            .setCustomId("view_event_Tower")
            .setLabel(t("map_rotation.events.tower"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Tower),
          new ButtonBuilder()
            .setCustomId("view_event_Bunker")
            .setLabel(t("map_rotation.events.bunker"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Bunker),
        );
        row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("view_event_Matriarch")
            .setLabel(t("map_rotation.events.matriarch"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Matriarch),
          new ButtonBuilder()
            .setCustomId("view_event_Cold")
            .setLabel(t("map_rotation.events.cold"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Cold),
          new ButtonBuilder()
            .setCustomId("view_event_Gate")
            .setLabel(t("map_rotation.events.gate"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Gate),
          new ButtonBuilder()
            .setCustomId("view_mode_map")
            .setLabel(t("map_rotation.buttons.show_map"))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🗺️"),
          new ButtonBuilder()
            .setCustomId("view_mode_minor")
            .setLabel(t("map_rotation.buttons.show_minor"))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🔍"),
        );
        // Add third row for navigation in major mode
        const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("view_overview")
            .setLabel(t("map_rotation.buttons.home"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🏠"),
        );
        return [row1, row2, row3];
      } else {
        // minor
        row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("view_event_Husks")
            .setLabel(t("map_rotation.events.husks"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Husks),
          new ButtonBuilder()
            .setCustomId("view_event_Blooms")
            .setLabel(t("map_rotation.events.blooms"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Blooms),
          new ButtonBuilder()
            .setCustomId("view_event_Caches")
            .setLabel(t("map_rotation.events.caches"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Caches),
          new ButtonBuilder()
            .setCustomId("view_event_Probes")
            .setLabel(t("map_rotation.events.probes"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONDITION_EMOJIS.Probes),
        );
        row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("view_mode_map")
            .setLabel(t("map_rotation.buttons.show_map"))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🗺️"),
          new ButtonBuilder()
            .setCustomId("view_mode_major")
            .setLabel(t("map_rotation.buttons.show_major"))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("⚔️"),
          new ButtonBuilder()
            .setCustomId("view_overview")
            .setLabel(t("map_rotation.buttons.home"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🏠"),
        );
      }
      return [row1, row2];
    };

    // handle view mode switching
    if (customId === "view_mode_major") {
      await interaction.editReply({ components: getButtons("major") });
      return;
    }
    if (customId === "view_mode_minor") {
      await interaction.editReply({ components: getButtons("minor") });
      return;
    }
    if (customId === "view_mode_map") {
      await interaction.editReply({ components: getButtons("map") });
      return;
    }

    // handle home / overview
    if (customId === "view_overview") {
      const { embed, files, components } = await buildMapRotationMessage(mobileFriendly, locale);

      // We need to preserve the buttons state if possible, but buildMapRotationMessage returns fresh components.
      // The requirement is to match the original formatting, which buildMapRotationMessage does.
      // However, we might want to ensure the buttons are in the correct state (Home disabled).
      // buildMapRotationMessage returns Home disabled by default in row 2.

      await interaction.editReply({
        embeds: [embed],
        files: files,
        components: components,
      });
      return;
    }

    if (customId.startsWith("view_map_")) {
      const location = customId.replace("view_map_", "");
      // Map location key to translation key (camelCase to snake_case)
      const locationKeyMap: Record<string, string> = {
        dam: "dam",
        buriedCity: "buried_city",
        spaceport: "spaceport",
        blueGate: "blue_gate",
        stellaMontis: "stella_montis",
      };
      const locationKey = locationKeyMap[location] || location;
      const locationName = t(`map_rotation.locations.${locationKey}`);

      const currentHour = current.hour;
      const nextRotationTs = getNextRotationTimestamp();

      const { descriptionSuffix, fields } = buildForecast({
        t,
        currentHour,
        nextRotationTs,
        filter: { type: "location", value: location },
        mobileFriendly,
      });

      let description = `${t("map_rotation.forecast.title_location", { location: locationName })}\n${t("map_rotation.forecast.next_rotation", { timestamp: nextTimestamp })}\n\n`;

      if (mobileFriendly || (!mobileFriendly && !fields.length)) {
        description += descriptionSuffix;
      }

      embed.setDescription(description.trim()); // trim to remove extra newlines if any
      embed.setImage("attachment://map-status.png");
      embed.setFields(fields);

      const buttons = getButtons("map");
      enableHomeButton(buttons);

      await interaction.editReply({ embeds: [embed], components: buttons });
      return;
    }

    // handle event type filter
    if (customId.startsWith("view_event_")) {
      const eventType = customId.replace("view_event_", "");
      const emoji = eventType === "None" ? "✅" : CONDITION_EMOJIS[eventType] || "";
      const eventName = translateEvent(t, eventType);

      const currentHour = current.hour;
      const nextRotationTs = getNextRotationTimestamp();

      const { descriptionSuffix, fields } = buildForecast({
        t,
        currentHour,
        nextRotationTs,
        filter: { type: "event", value: eventType },
        mobileFriendly,
      });

      let description = `${t("map_rotation.forecast.title_event", { emoji, event: eventName })}\n${t("map_rotation.forecast.next_rotation", { timestamp: nextTimestamp })}\n\n`;

      if (mobileFriendly || (!mobileFriendly && !fields.length)) {
        description += descriptionSuffix;
      }

      embed.setDescription(description.trim());
      embed.setImage("attachment://map-status.png");
      embed.setFields(fields);

      const majorEvents = [
        "Harvester",
        "Night",
        "Storm",
        "Tower",
        "Bunker",
        "Matriarch",
        "Cold",
        "Gate",
      ];
      const mode = majorEvents.includes(eventType) ? "major" : "minor";

      const buttons = getButtons(mode);
      enableHomeButton(buttons);

      await interaction.editReply({ embeds: [embed], components: buttons });
      return;
    }

    logger.info(`Button clicked: ${customId}`);
  } catch (error) {
    logger.error({ err: error }, "Error handling button interaction");

    // Try to provide user feedback if possible
    try {
      const t = getT(interaction.locale);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: t("common.error") || "An error occurred while processing your request.",
          flags: Number(MessageFlags.Ephemeral),
        });
      } else {
        await interaction.followUp({
          content: t("common.error") || "An error occurred while processing your request.",
          flags: Number(MessageFlags.Ephemeral),
        });
      }
    } catch (replyError) {
      // If we can't send feedback, just log it
      logger.debug({ err: replyError }, "Could not send error feedback to user");
    }
  }
}
