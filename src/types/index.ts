import type {
  ChatInputCommandInteraction,
  ClientEvents,
  Collection,
  SlashCommandBuilder,
} from "discord.js";

export type NotificationMethod = "pin-edit" | "post-delete" | "post-keep";

export interface ServerConfigEntry {
  channelId: string;
  serverName?: string;
  messageId?: string;
  lastUpdated?: string;
  mobileFriendly?: boolean;
  locale?: string;
  notificationMethod?: NotificationMethod;
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

/**
 * Validation status for a single server configuration
 */
export type ValidationStatus =
  | "valid"
  | "dead_guild"
  | "dead_channel"
  | "dead_message"
  | "permission_error";

/**
 * Entry representing a validated server configuration
 */
export interface ValidatedServerEntry {
  guildId: string;
  config: ServerConfigEntry;
  status: ValidationStatus;
  error?: string;
}

/**
 * Results from startup validation process
 */
export interface ValidationResult {
  /** Servers that passed all validation checks */
  valid: ValidatedServerEntry[];
  /** Guild IDs where bot is no longer a member - will be deleted */
  deadGuilds: string[];
  /** Guild IDs with deleted/inaccessible channels - will be deleted */
  deadChannels: string[];
  /** Guild IDs with deleted messages - message_id will be nullified */
  deadMessages: string[];
  /** Guild IDs with permission errors - logged only, no action taken */
  permissionErrors: string[];
}

declare module "discord.js" {
  export interface Client {
    commands: Collection<string, Command>;
  }
}
