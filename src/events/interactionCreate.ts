import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import {
  CONDITION_COLORS,
  CONDITION_EMOJIS,
  getCurrentRotation,
  getNextRotationTimestamp,
} from "../config/mapRotation";
import { createFeedbackModal } from "../commands/feedback";
import { type FeedbackType, saveFeedback } from "../repositories/feedbackRepository";
import { getT, translateEvent } from "../utils/i18n";
import { generateForecast } from "../utils/forecastGenerator";
import { interactionLockManager } from "../utils/interactionLock";
import { logger } from "../utils/logger";
import { createMapRotationEmbed } from "../utils/messageManager";
import { notifyFeedbackReceived } from "../utils/observabilityWebhook";
import { getServerConfig } from "../utils/serverConfig";

export async function handleInteraction(interaction: Interaction) {
  // Handle feedback type selection
  if (interaction.isStringSelectMenu() && interaction.customId === "feedback_type_select") {
    await handleFeedbackTypeSelect(interaction);
    return;
  }

  // Handle feedback modal submission
  if (interaction.isModalSubmit() && interaction.customId.startsWith("feedback_modal_")) {
    await handleFeedbackModalSubmit(interaction);
    return;
  }

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

    const current = await getCurrentRotation();
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

      const { descriptionSuffix, fields } = generateForecast({
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
      (buttons[1].components[2] as ButtonBuilder).setDisabled(false);

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

      const { descriptionSuffix, fields } = generateForecast({
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

async function handleFeedbackTypeSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  try {
    const feedbackType = interaction.values[0];
    const config = interaction.guildId ? await getServerConfig(interaction.guildId) : null;
    const locale = config?.locale || interaction.guild?.preferredLocale || "en";
    const t = getT(locale);

    const modal = createFeedbackModal(feedbackType, t);
    await interaction.showModal(modal);
  } catch (error) {
    logger.error({ err: error }, "Error handling feedback type selection");
  }
}

async function handleFeedbackModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    const feedbackType = interaction.customId.replace("feedback_modal_", "") as FeedbackType;
    const message = interaction.fields.getTextInputValue("feedback_message");
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const config = guildId ? await getServerConfig(guildId) : null;
    const locale = config?.locale || interaction.guild?.preferredLocale || "en";
    const t = getT(locale);

    if (!guildId) {
      await interaction.reply({
        content: t("common.only_in_guild"),
        flags: Number(MessageFlags.Ephemeral),
      });
      return;
    }

    // Save feedback to database
    await saveFeedback(guildId, userId, feedbackType, message);

    // Send webhook notification
    await notifyFeedbackReceived(feedbackType, guildId, message);

    await interaction.reply({
      content: t("commands.feedback.success"),
      flags: Number(MessageFlags.Ephemeral),
    });

    logger.info({ guildId, userId, feedbackType }, "Feedback submitted successfully");
  } catch (error) {
    logger.error({ err: error }, "Error handling feedback modal submission");

    const config = interaction.guildId ? await getServerConfig(interaction.guildId) : null;
    const locale = config?.locale || interaction.guild?.preferredLocale || "en";
    const t = getT(locale);

    await interaction.reply({
      content: t("commands.feedback.error"),
      flags: Number(MessageFlags.Ephemeral),
    });
  }
}
