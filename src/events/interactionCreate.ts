import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Interaction,
} from "discord.js";
import {
  CONDITION_COLORS,
  CONDITION_EMOJIS,
  getCurrentRotation,
  getNextRotationTimestamp,
  MAP_ROTATIONS,
} from "../config/mapRotation";
import { getT } from "../utils/i18n";
import { interactionLockManager } from "../utils/interactionLock";
import { logger } from "../utils/logger";
import { createMapRotationEmbed } from "../utils/messageManager";
import { getServerConfigs } from "../utils/serverConfig";

export async function handleInteraction(interaction: Interaction) {
  if (!interaction.isButton()) return;

  try {
    const { customId, message, user, guildId } = interaction;
    const messageId = message.id;
    const userId = user.id;

    // Check lock status
    if (!interactionLockManager.canInteract(messageId, userId)) {
      const remaining = interactionLockManager.getRemainingTime(messageId);
      // Use interaction locale for ephemeral error
      const t = getT(interaction.locale);
      await interaction.reply({
        content: t("common.menu_locked", { remaining }),
        ephemeral: true,
      });
      return;
    }

    // Acquire or refresh lock automatically
    if (guildId && message.channelId) {
      interactionLockManager.acquireLock(messageId, userId, message.channelId, guildId);
    }

    await interaction.deferUpdate();

    // Get Server Config
    const configs = await getServerConfigs();
    const config = guildId ? configs[guildId] : null;
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
            .setCustomId("view_mode_map")
            .setLabel(t("map_rotation.buttons.show_map"))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🗺️"),
          new ButtonBuilder()
            .setCustomId("view_mode_minor")
            .setLabel(t("map_rotation.buttons.show_minor"))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🔍"),
          new ButtonBuilder()
            .setCustomId("view_overview")
            .setLabel(t("map_rotation.buttons.home"))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🏠"),
        );
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

    // Helper to translate event names (basic mapping)
    const translateEvent = (event: string) => {
      if (event === "None") return t("map_rotation.events.none");
      const key = event.toLowerCase();
      // Check if key exists in translation (simple check)
      return t(`map_rotation.events.${key}`, { defaultValue: event });
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
      const { embed, files, components } = await createMapRotationEmbed(mobileFriendly, locale);

      // We need to preserve the buttons state if possible, but createMapRotationEmbed returns fresh components.
      // The requirement is to match the original formatting, which createMapRotationEmbed does.
      // However, we might want to ensure the buttons are in the correct state (Home disabled).
      // createMapRotationEmbed returns Home disabled by default in row 2.

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

      embed.setDescription(
        `${t("map_rotation.forecast.title_location", { location: locationName })}\n${t("map_rotation.forecast.next_rotation", { timestamp: nextTimestamp })}`,
      );
      embed.setImage("attachment://map-status.png");
      embed.setFields([]);

      if (mobileFriendly) {
        let description = `${t("map_rotation.forecast.title_location", { location: locationName })}\n${t("map_rotation.forecast.next_rotation", { timestamp: nextTimestamp })}\n\n`;
        let hasEvents = false;

        for (let i = 1; i <= 24; i++) {
          const hourIndex = (currentHour + i) % 24;
          const rotation = MAP_ROTATIONS[hourIndex];
          const timestamp = nextRotationTs + (i - 1) * 3600;
          const timeLabel = `<t:${timestamp}:R>`;

          const major = rotation[`${location}Major` as keyof typeof rotation];
          const minor = rotation[`${location}Minor` as keyof typeof rotation];

          if (major !== "None" || minor !== "None") {
            let eventText = "";
            if (major !== "None")
              eventText += `${CONDITION_EMOJIS[major]} ${translateEvent(String(major))} `;
            if (minor !== "None")
              eventText += `${CONDITION_EMOJIS[minor]} ${translateEvent(String(minor))}`;

            description += `**${timeLabel}** • ${eventText}\n`;
            hasEvents = true;
          }
        }

        if (!hasEvents) description += t("map_rotation.forecast.no_events");
        embed.setDescription(description);
      } else {
        // Desktop: Inline Fields
        let hasEvents = false;
        let timeCol = "";
        let conditionCol = "";

        for (let i = 1; i <= 24; i++) {
          const hourIndex = (currentHour + i) % 24;
          const rotation = MAP_ROTATIONS[hourIndex];
          const timestamp = nextRotationTs + (i - 1) * 3600;
          const timeLabel = `<t:${timestamp}:R>`;

          const major = rotation[`${location}Major` as keyof typeof rotation];
          const minor = rotation[`${location}Minor` as keyof typeof rotation];

          if (major !== "None" || minor !== "None") {
            let eventText = "";
            if (major !== "None")
              eventText += `${CONDITION_EMOJIS[major]} ${translateEvent(String(major))} `;
            if (minor !== "None")
              eventText += `${CONDITION_EMOJIS[minor]} ${translateEvent(String(minor))}`;

            timeCol += `${timeLabel}\n`;
            conditionCol += `${eventText}\n`;
            hasEvents = true;
          }
        }

        if (hasEvents) {
          embed.addFields(
            { name: t("map_rotation.forecast.time_until"), value: timeCol, inline: true },
            { name: t("map_rotation.forecast.conditions"), value: conditionCol, inline: true },
            { name: "\u200b", value: "\u200b", inline: true },
          );
        } else {
          embed.setDescription(
            `${embed.data.description}\n\n${t("map_rotation.forecast.no_events")}`,
          );
        }
      }

      const buttons = getButtons("map");
      (buttons[1].components[2] as ButtonBuilder).setDisabled(false);

      await interaction.editReply({ embeds: [embed], components: buttons });
      return;
    }

    // handle event type filter
    if (customId.startsWith("view_event_")) {
      const eventType = customId.replace("view_event_", "");
      const emoji = eventType === "None" ? "✅" : CONDITION_EMOJIS[eventType] || "";
      const eventName = translateEvent(eventType);

      const currentHour = current.hour;
      const nextRotationTs = getNextRotationTimestamp();
      const locations = ["dam", "buriedCity", "spaceport", "blueGate", "stellaMontis"];

      embed.setDescription(
        `${t("map_rotation.forecast.title_event", { emoji, event: eventName })}\n${t("map_rotation.forecast.next_rotation", { timestamp: nextTimestamp })}`,
      );
      embed.setImage("attachment://map-status.png");
      embed.setFields([]);

      if (mobileFriendly) {
        let description = `${t("map_rotation.forecast.title_event", { emoji, event: eventName })}\n${t("map_rotation.forecast.next_rotation", { timestamp: nextTimestamp })}\n\n`;
        let hasEvents = false;

        for (let i = 1; i <= 24; i++) {
          const hourIndex = (currentHour + i) % 24;
          const rotation = MAP_ROTATIONS[hourIndex];
          const timestamp = nextRotationTs + (i - 1) * 3600;
          const timeLabel = `<t:${timestamp}:R>`;

          const occurringLocations = [];
          for (const loc of locations) {
            if (
              rotation[`${loc}Major` as keyof typeof rotation] === eventType ||
              rotation[`${loc}Minor` as keyof typeof rotation] === eventType
            ) {
              // Map loc to translation key
              const locationKeyMap: Record<string, string> = {
                dam: "dam",
                buriedCity: "buried_city",
                spaceport: "spaceport",
                blueGate: "blue_gate",
                stellaMontis: "stella_montis",
              };
              const locKey = locationKeyMap[loc] || loc;
              const locName = t(`map_rotation.locations.${locKey}`);
              occurringLocations.push(locName);
            }
          }

          if (occurringLocations.length > 0) {
            const locText = occurringLocations.join(", ");
            description += `**${timeLabel}** • ${locText}\n`;
            hasEvents = true;
          }
        }

        if (!hasEvents) description += t("map_rotation.forecast.no_events");
        embed.setDescription(description);
      } else {
        // Desktop: Inline Fields
        let hasEvents = false;
        let timeCol = "";
        let locCol = "";

        for (let i = 1; i <= 24; i++) {
          const hourIndex = (currentHour + i) % 24;
          const rotation = MAP_ROTATIONS[hourIndex];
          const timestamp = nextRotationTs + (i - 1) * 3600;
          const timeLabel = `<t:${timestamp}:R>`;

          const occurringLocations = [];
          for (const loc of locations) {
            if (
              rotation[`${loc}Major` as keyof typeof rotation] === eventType ||
              rotation[`${loc}Minor` as keyof typeof rotation] === eventType
            ) {
              const locationKeyMap: Record<string, string> = {
                dam: "dam",
                buriedCity: "buried_city",
                spaceport: "spaceport",
                blueGate: "blue_gate",
                stellaMontis: "stella_montis",
              };
              const locKey = locationKeyMap[loc] || loc;
              const locName = t(`map_rotation.locations.${locKey}`);
              occurringLocations.push(locName);
            }
          }

          if (occurringLocations.length > 0) {
            const locText = occurringLocations.join(", ");
            timeCol += `${timeLabel}\n`;
            locCol += `${locText}\n`;
            hasEvents = true;
          }
        }

        if (hasEvents) {
          embed.addFields(
            { name: t("map_rotation.forecast.time_until"), value: timeCol, inline: true },
            { name: t("map_rotation.forecast.locations"), value: locCol, inline: true },
            { name: "\u200b", value: "\u200b", inline: true },
          );
        } else {
          embed.setDescription(
            `${embed.data.description}\n\n${t("map_rotation.forecast.no_events")}`,
          );
        }
      }

      const majorEvents = ["Harvester", "Night", "Storm", "Tower", "Bunker", "Matriarch"];
      const mode = majorEvents.includes(eventType) ? "major" : "minor";

      const buttons = getButtons(mode);
      (buttons[1].components[3] || (buttons[1].components[2] as ButtonBuilder)).setDisabled(false);

      await interaction.editReply({ embeds: [embed], components: buttons });
      return;
    }

    logger.info(`Button clicked: ${customId}`);
  } catch (error) {
    logger.error({ err: error }, "Error handling interaction");
  }
}
