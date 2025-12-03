import type { ChatInputCommandInteraction, ClientEvents, SlashCommandBuilder } from "discord.js";

export interface ServerConfigEntry {
  channelId: string;
  serverName?: string;
  messageId?: string;
  lastUpdated?: string;
  mobileFriendly?: boolean;
  locale?: string;
}

export interface ServerConfig {
  [guildId: string]: ServerConfigEntry;
}
export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface Event {
  name: keyof ClientEvents;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<void> | void;
}

export interface MapRotation {
  hour: number;
  damMinor: string;
  damMajor: string;
  buriedCityMinor: string;
  buriedCityMajor: string;
  spaceportMinor: string;
  spaceportMajor: string;
  blueGateMinor: string;
  blueGateMajor: string;
  stellaMontisMinor: string;
  stellaMontisMajor: string;
}
