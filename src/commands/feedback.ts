import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { Command } from "../types";
import { getT } from "../utils/i18n";
import { logger } from "../utils/logger";
import { buildCommandLocalizations, loadAvailableLocales } from "../utils/localeLoader";
import { getServerConfig } from "../utils/serverConfig";
import { canSubmitFeedback } from "../repositories/feedbackRepository";

const locales = loadAvailableLocales();
const { nameLocalizations, descriptionLocalizations } = buildCommandLocalizations(
  "feedback",
  locales,
);

const FeedbackCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("feedback")
    .setNameLocalizations(nameLocalizations)
    .setDescription("Submit feedback about the bot")
    .setDescriptionLocalizations(descriptionLocalizations) as Command["data"],

  async execute(interaction: ChatInputCommandInteraction) {
    const config = interaction.guildId ? await getServerConfig(interaction.guildId) : null;
    const locale = config?.locale || interaction.guild?.preferredLocale || "en";
    const t = getT(locale);

    if (!interaction.guildId) {
      await interaction.reply({
        content: t("common.only_in_guild"),
        flags: Number(MessageFlags.Ephemeral),
      });
      return;
    }

    const userId = interaction.user.id;

    // Check rate limit
    const rateLimitResult = await canSubmitFeedback(userId);
    if (!rateLimitResult.canSubmit) {
      await interaction.reply({
        content: t("commands.feedback.rate_limited", {
          minutes: (rateLimitResult as { canSubmit: false; remainingMinutes: number })
            .remainingMinutes,
        }),
        flags: Number(MessageFlags.Ephemeral),
      });
      return;
    }

    // Show type selection menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("feedback_type_select")
      .setPlaceholder(t("commands.feedback.select_type_placeholder"))
      .addOptions([
        {
          label: t("commands.feedback.type_bug"),
          value: "bug",
          emoji: "🐛",
        },
        {
          label: t("commands.feedback.type_suggestion"),
          value: "suggestion",
          emoji: "💡",
        },
        {
          label: t("commands.feedback.type_general"),
          value: "general",
          emoji: "💬",
        },
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content: t("commands.feedback.select_type_prompt"),
      components: [row],
      flags: Number(MessageFlags.Ephemeral),
    });

    logger.info({ guildId: interaction.guildId, userId }, "Feedback command initiated");
  },
};

/**
 * Creates the feedback modal for a given type
 */
export function createFeedbackModal(
  feedbackType: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`feedback_modal_${feedbackType}`)
    .setTitle(t("commands.feedback.modal_title"));

  const messageInput = new TextInputBuilder()
    .setCustomId("feedback_message")
    .setLabel(t("commands.feedback.message_label"))
    .setPlaceholder(t("commands.feedback.message_placeholder"))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(1000);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
  modal.addComponents(row);

  return modal;
}

module.exports = FeedbackCommand;
