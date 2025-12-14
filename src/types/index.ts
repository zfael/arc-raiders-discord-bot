import type {
  ChatInputCommandInteraction,
  ClientEvents,
  Collection,
  SlashCommandBuilder,
} from "discord.js";

export type NotificationMethod = "pin-edit" | "post-delete" | "post-keep";

export type PingTarget = "none" | "everyone" | "role";

export interface ServerConfigEntry {
  channelId: string;
  serverName?: string;
  messageId?: string;
  lastUpdated?: string;
  mobileFriendly?: boolean;
  locale?: string;
  notificationMethod?: NotificationMethod;
  pingTarget?: PingTarget;
  pingRoleId?: string;
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

declare module "discord.js" {
  export interface Client {
    commands: Collection<string, Command>;
  }
}
