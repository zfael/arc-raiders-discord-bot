import {
  ChannelType,
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextChannel,
} from "discord.js";
import type { Command } from "../types";
import { getT } from "../utils/i18n";
import { logger } from "../utils/logger";
import {
  buildCommandLocalizations,
  buildOptionLocalizations,
  loadAvailableLocales,
} from "../utils/localeLoader";
import { postOrUpdateInChannel } from "../utils/messageManager";
import { getServerConfigs, setServerConfig } from "../utils/serverConfig";

const locales = loadAvailableLocales();
const { nameLocalizations, descriptionLocalizations } = buildCommandLocalizations(
  "set-channel",
  locales,
);
const channelOptionLocalizations = buildOptionLocalizations("set-channel", "channel", locales);
const roleOptionLocalizations = buildOptionLocalizations("set-channel", "role", locales);

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
    .addRoleOption((option) =>
      option
        .setName("role")
        .setNameLocalizations(roleOptionLocalizations.nameLocalizations)
        .setDescription("Role to mention on the initial post (optional)")
        .setDescriptionLocalizations(roleOptionLocalizations.descriptionLocalizations)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as Command["data"],
  async execute(interaction: ChatInputCommandInteraction) {
    // Get Server Config for locale
    const configs = await getServerConfigs();
    const config = interaction.guildId ? configs[interaction.guildId] : null;
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
    const role = interaction.options.getRole("role") ?? undefined;
    const roleId = role?.id ?? null;

    // If a role is provided, ping that role on the initial post; otherwise don't ping anyone.
    const pingTarget = roleId != null ? "role" : "none";

    await setServerConfig(
      interaction.guildId,
      channel.id,
      interaction.guild?.name || "Unknown",
      pingTarget,
      roleId,
    );
    logger.info(
      `Set-channel configured for server: ${interaction.guild?.name} (ID: ${interaction.guildId}), channel: #${channel.name} (${channel.id})`,
    );

    // Reply immediately
    await interaction.editReply({
      content: t("commands.set_channel.success", { channel: `#${channel.name}` }),
    });

    // Trigger map status update in the background (don't await)
    postOrUpdateInChannel(
      interaction.client,
      interaction.guildId,
      channel.id,
      undefined,
      undefined,
      true,
    ).catch((error) => {
      logger.error({ err: error }, `Failed to post initial update to ${channel.id}`);
    });
  },
};

module.exports = SetChannelCommand;
