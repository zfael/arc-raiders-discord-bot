import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, CommandInteraction, TextChannel } from 'discord.js';
import { setServerConfig } from '../utils/serverConfig';
import { Command } from '../types';

const SetChannelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('set-channel')
    .setDescription('Sets the channel for map rotation updates.')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send updates to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction: CommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.options.get('channel')?.channel as TextChannel;

    if (!channel) {
      await interaction.reply({
        content: 'No channel was provided.',
        ephemeral: true,
      });
      return;
    }

    setServerConfig(interaction.guildId, channel.id);

    await interaction.reply({
      content: `Map rotation updates will now be sent to #${channel.name}.`,
      ephemeral: true,
    });
  },
};

module.exports = SetChannelCommand;
