import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../types";
import { getT } from "../utils/i18n/i18n";
import {
  buildCommandLocalizations,
  buildOptionLocalizations,
  loadAvailableLocales,
} from "../utils/i18n/localeLoader";
import { logger } from "../utils/logger";
import { postOrUpdateInChannel } from "../utils/discord/messageManager";
import {
  getServerConfig,
  setMobileFriendly,
  setNotificationMethod,
  setServerLocale,
} from "../utils/database/serverConfig";

const locales = loadAvailableLocales();
const { nameLocalizations, descriptionLocalizations } = buildCommandLocalizations(
  "settings",
  locales,
);
const mobileFriendlyLocalizations = buildOptionLocalizations(
  "settings",
  "mobile-friendly",
  locales,
);
const localeOptionLocalizations = buildOptionLocalizations("settings", "locale", locales);
const notificationMethodLocalizations = buildOptionLocalizations(
  "settings",
  "notification-method",
  locales,
);

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
        .addChoices(
          ...Array.from(locales.entries()).map(([code, data]) => ({
            name: data._language_name || code,
            value: code,
          })),
        ),
    )
    .addStringOption((option) =>
      option
        .setName("notification-method")
        .setDescription("How map updates are posted to the channel")
        .setNameLocalizations(notificationMethodLocalizations.nameLocalizations)
        .setDescriptionLocalizations(notificationMethodLocalizations.descriptionLocalizations)
        .setRequired(false)
        .addChoices(
          { name: "📌 Pin & Edit (1 updated message)", value: "pin-edit" },
          { name: "🔄 Hourly Post & Delete Old", value: "post-delete" },
          { name: "📝 Hourly Post & Keep History", value: "post-keep" },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as Command["data"],
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      const t = getT(interaction.locale);
      await interaction.reply({
        content: t("common.error"),
        flags: Number(MessageFlags.Ephemeral),
      });
      return;
    }

    // Get current config to determine locale for response
    const currentConfig = await getServerConfig(interaction.guildId);
    const currentLocale = currentConfig?.locale || interaction.guild?.preferredLocale || "en";
    const t = getT(currentLocale);

    const mobileFriendly = interaction.options.getBoolean("mobile-friendly");
    const locale = interaction.options.getString("locale");
    const notificationMethod = interaction.options.getString("notification-method") as
      | "pin-edit"
      | "post-delete"
      | "post-keep"
      | null;

    if (mobileFriendly === null && locale === null && notificationMethod === null) {
      await interaction.reply({
        content: t("commands.settings.no_changes"),
        flags: Number(MessageFlags.Ephemeral),
      });
      return;
    }

    await interaction.deferReply({ flags: Number(MessageFlags.Ephemeral) });

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
        // Re-initialize t with new locale
        const newT = getT(locale);
        const localeData = locales.get(locale);
        const localeName = localeData?._language_name || locale;
        responseMessage += `${newT("commands.settings.locale_updated", { locale: localeName })}\n`;
      }

      if (notificationMethod !== null) {
        await setNotificationMethod(interaction.guildId, notificationMethod);
        const methodName = t(`commands.settings.notification_methods.${notificationMethod}`);
        responseMessage += `${t("commands.settings.notification_method_updated", { method: methodName })}\n`;
      }

      await interaction.editReply({
        content: responseMessage.trim(),
      });

      logger.info(
        `Settings updated for guild ${interaction.guildId}: mobileFriendly=${mobileFriendly}, locale=${locale}, notificationMethod=${notificationMethod}`,
      );

      // Trigger immediate update of the map message
      const updatedConfig = await getServerConfig(interaction.guildId);
      if (updatedConfig?.channelId) {
        await postOrUpdateInChannel(
          interaction.client,
          interaction.guildId,
          updatedConfig.channelId,
          {
            existingMessageId: updatedConfig.messageId,
            localeOverride: locale || undefined, // Pass the new locale if it was updated
            configOverride: updatedConfig,
          },
        );
      }
    } catch (error) {
      logger.error({ err: error }, "Error executing settings command");
      await interaction.editReply({
        content: t("common.error"),
      });
    }
  },
};

module.exports = SettingsCommand;
