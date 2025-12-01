import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";
import { getT } from "../utils/i18n";
import { buildCommandLocalizations, loadAvailableLocales } from "../utils/localeLoader";
import { getServerConfigs } from "../utils/serverConfig";

const locales = loadAvailableLocales();
const { nameLocalizations, descriptionLocalizations } = buildCommandLocalizations("ping", locales);

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setNameLocalizations(nameLocalizations)
    .setDescription("Replies with Pong! and shows bot latency")
    .setDescriptionLocalizations(descriptionLocalizations),

  async execute(interaction: ChatInputCommandInteraction) {
    // Get Server Config for locale
    const configs = await getServerConfigs();
    const config = interaction.guildId ? configs[interaction.guildId] : null;
    const locale = config?.locale || interaction.guild?.preferredLocale || "en";
    const t = getT(locale);

    const sent = await interaction.reply({
      content: t("commands.ping.pinging"),
      fetchReply: true,
    });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    await interaction.editReply(t("commands.ping.response", { latency, apiLatency }));
  },
};

module.exports = command;
