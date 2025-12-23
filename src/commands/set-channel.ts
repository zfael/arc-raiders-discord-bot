import {
  ChannelType,
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextChannel,
} from "discord.js";
import type { Command } from "../types";
import { getT } from "../utils/i18n/i18n";
import { logger } from "../utils/logger";
import {
  buildCommandLocalizations,
  buildOptionLocalizations,
  loadAvailableLocales,
} from "../utils/i18n/localeLoader";
import { postOrUpdateInChannel } from "../utils/discord/messageManager";
import { getServerConfig, setServerConfig } from "../utils/database/serverConfig";

const locales = loadAvailableLocales();
const { nameLocalizations, descriptionLocalizations } = buildCommandLocalizations(
  "set-channel",
  locales,
);
const channelOptionLocalizations = buildOptionLocalizations("set-channel", "channel", locales);

const SetChannelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("set-channel")
    .setNameLocalizations(nameLocalizations)
    .setDescription("Sets the channel for map rotation updates.")
    .setDescriptionLocalizations(descriptionLocalizations)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setNameLocalizations(channelOptionLocalizations.nameLocalizations)
        .setDescription("The channel to send updates to")
        .setDescriptionLocalizations(channelOptionLocalizations.descriptionLocalizations)
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as Command["data"],
  async execute(interaction: ChatInputCommandInteraction) {
    // Get Server Config for locale
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

    // Defer reply immediately to prevent timeout while generating image
    await interaction.deferReply({ flags: Number(MessageFlags.Ephemeral) });

    const channel = interaction.options.getChannel("channel", true) as TextChannel;

    await setServerConfig(interaction.guildId, channel.id, interaction.guild?.name || "Unknown");
    logger.info(
      `Set-channel configured for server: ${interaction.guild?.name} (ID: ${interaction.guildId}), channel: #${channel.name} (${channel.id})`,
    );

    // Reply immediately
    await interaction.editReply({
      content: t("commands.set_channel.success", { channel: `#${channel.name}` }),
    });

    // Trigger map status update in the background (don't await)
    postOrUpdateInChannel(interaction.client, interaction.guildId, channel.id).catch((error) => {
      logger.error({ err: error }, `Failed to post initial update to ${channel.id}`);
    });
  },
};

module.exports = SetChannelCommand;
