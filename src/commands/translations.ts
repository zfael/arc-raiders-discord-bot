import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../types";
import { getT } from "../utils/i18n/i18n";
import { buildCommandLocalizations, loadAvailableLocales } from "../utils/i18n/localeLoader";
import { getServerConfig } from "../utils/database/serverConfig";

const locales = loadAvailableLocales();
const { nameLocalizations, descriptionLocalizations } = buildCommandLocalizations(
  "translations",
  locales,
);

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("translations")
    .setNameLocalizations(nameLocalizations)
    .setDescription("Learn how to help translate this bot into your language")
    .setDescriptionLocalizations(descriptionLocalizations),

  async execute(interaction: ChatInputCommandInteraction) {
    // Get Server Config for locale
    const config = interaction.guildId ? await getServerConfig(interaction.guildId) : null;
    const locale = config?.locale || interaction.guild?.preferredLocale || "en";
    const t = getT(locale);

    // Get list of available languages
    const availableLanguages = Array.from(locales.entries())
      .map(([code, data]) => `• ${data._language_name || code}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(t("commands.translations.title"))
      .setColor(0x5865f2)
      .setDescription(t("commands.translations.description"))
      .addFields(
        {
          name: t("commands.translations.available_languages"),
          value: availableLanguages,
          inline: false,
        },
        {
          name: t("commands.translations.how_to_help"),
          value: t("commands.translations.steps"),
          inline: false,
        },
        {
          name: t("commands.translations.what_to_translate"),
          value: t("commands.translations.sections"),
          inline: false,
        },
        {
          name: t("commands.translations.important_rules"),
          value: t("commands.translations.rules"),
          inline: false,
        },
      )
      .setFooter({ text: t("commands.translations.footer") });

    await interaction.reply({ embeds: [embed], flags: Number(MessageFlags.Ephemeral) });
  },
};

module.exports = command;
