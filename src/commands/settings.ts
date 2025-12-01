import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../types";
import { getT } from "../utils/i18n";
import { buildCommandLocalizations, buildOptionLocalizations, loadAvailableLocales } from "../utils/localeLoader";
import { logger } from "../utils/logger";
import { getServerConfigs, setMobileFriendly, setServerLocale } from "../utils/serverConfig";

const locales = loadAvailableLocales();
const { nameLocalizations, descriptionLocalizations } = buildCommandLocalizations("settings", locales);
const mobileFriendlyLocalizations = buildOptionLocalizations("settings", "mobile-friendly", locales);
const localeOptionLocalizations = buildOptionLocalizations("settings", "locale", locales);

const SettingsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Configure bot settings for this server.")
    .setNameLocalizations(nameLocalizations)
    .setDescriptionLocalizations(descriptionLocalizations)
    .addBooleanOption((option) =>
      option
        .setName("mobile-friendly")
        .setDescription("Enable mobile-friendly view for map updates (default: false)")
        .setNameLocalizations(mobileFriendlyLocalizations.nameLocalizations)
        .setDescriptionLocalizations(mobileFriendlyLocalizations.descriptionLocalizations)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("locale")
        .setDescription("Set the language for the bot in this server")
        .setNameLocalizations(localeOptionLocalizations.nameLocalizations)
        .setDescriptionLocalizations(localeOptionLocalizations.descriptionLocalizations)
        .setRequired(false)
        .addChoices({ name: "English", value: "en" }, { name: "Español", value: "es" }),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as Command["data"],
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      const t = getT(interaction.locale);
      await interaction.reply({
        content: t("common.error"),
        ephemeral: true,
      });
      return;
    }

    // Get current config to determine locale for response
    const configs = await getServerConfigs();
    const currentConfig = configs[interaction.guildId];
    const _currentMobileFriendly = currentConfig?.mobileFriendly ?? false;
    const currentLocale = currentConfig?.locale || interaction.guild?.preferredLocale || "en";
    const t = getT(currentLocale);
    // But for settings, we might want to respond in the NEW locale if changed, or the OLD one?
    // Let's stick to interaction.locale for the ephemeral response to the user running the command.
    // The previous line `const t = getT(interaction.locale);` is replaced by the above line `const t = getT(currentLocale);`
    // The user's provided edit block had a duplicate `const t` declaration, which is a syntax error.
    // Assuming the intent was to use `currentLocale` for `t`, the duplicate declaration is resolved by replacing the old one.

    const mobileFriendly = interaction.options.getBoolean("mobile-friendly");
    const locale = interaction.options.getString("locale");

    if (mobileFriendly === null && locale === null) {
      await interaction.reply({
        content: t("commands.settings.no_changes"),
        ephemeral: true,
      });
      return;
    }

    try {
      let responseMessage = "";

      if (mobileFriendly !== null) {
        await setMobileFriendly(interaction.guildId, mobileFriendly);
        const status = mobileFriendly
          ? t("commands.settings.enabled")
          : t("commands.settings.disabled");
        responseMessage += `${t("commands.settings.mobile_friendly_updated", { status })}\n`;
      }

      if (locale !== null) {
        await setServerLocale(interaction.guildId, locale);
        responseMessage += `${t("commands.settings.locale_updated", { locale: locale === "en" ? "English" : "Español" })}\n`;
      }

      await interaction.reply({
        content: responseMessage,
        ephemeral: true,
      });

      logger.info(
        `Settings updated for guild ${interaction.guildId}: mobileFriendly=${mobileFriendly}, locale=${locale}`,
      );
    } catch (error) {
      logger.error({ err: error }, "Error executing settings command");
      await interaction.reply({
        content: t("common.error"),
        ephemeral: true,
      });
    }
  },
};

module.exports = SettingsCommand;
