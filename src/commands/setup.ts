import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  ChannelSelectMenuBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  type Client,
  EmbedBuilder,
  type Guild,
  type GuildTextBasedChannel,
  type InteractionCollector,
  type MappedInteractionTypes,
  type MessageComponentType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type StringSelectMenuInteraction,
  StringSelectMenuBuilder,
} from "discord.js";
import type { Command, NotificationMethod } from "../types";
import { getT } from "../utils/i18n";
import { logger } from "../utils/logger";
import { buildCommandLocalizations, loadAvailableLocales } from "../utils/localeLoader";
import { postOrUpdateInChannel } from "../utils/messageManager";
import {
  getServerConfig,
  setMobileFriendly,
  setNotificationMethod,
  setServerConfig,
  setServerLocale,
} from "../utils/serverConfig";

const locales = loadAvailableLocales();
const { nameLocalizations, descriptionLocalizations } = buildCommandLocalizations("setup", locales);

const STEP_TIMEOUT = 180_000; // 3 minutes per step
const LOCALES_PER_PAGE = 25;

interface SetupWizardState {
  locale: string;
  channelId?: string;
  notificationMethod?: NotificationMethod;
  mobileFriendly?: boolean;
  currentStep: "language" | "channel" | "notification" | "permissions" | "mobile" | "complete";
  languagePage: number;
}

interface WizardContext {
  state: SetupWizardState;
  t: (key: string, options?: Record<string, unknown>) => string;
  guild: Guild;
  guildId: string;
  guildName: string;
  client: Client;
  collector: InteractionCollector<MappedInteractionTypes[MessageComponentType]>;
  updateT: (locale: string) => void;
}

const REQUIRED_PERMISSIONS_BASE = [
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
];

const PERMISSION_NAMES: Record<string, string> = {
  SendMessages: "permission_missing_send",
  EmbedLinks: "permission_missing_embed",
  AttachFiles: "permission_missing_attach",
  ManageMessages: "permission_missing_manage",
};

function getRequiredPermissions(method: NotificationMethod): bigint[] {
  const perms = [...REQUIRED_PERMISSIONS_BASE];
  if (method !== "post-keep") {
    perms.push(PermissionFlagsBits.ManageMessages);
  }
  return perms;
}

function getMissingPermissions(
  channel: GuildTextBasedChannel,
  method: NotificationMethod,
): string[] {
  const botMember = channel.guild.members.me;
  if (!botMember) return ["Bot not in guild"];

  const botPermissions = channel.permissionsFor(botMember);
  const required = getRequiredPermissions(method);
  const missing: string[] = [];

  const permNameMap: Record<string, string> = {
    [PermissionFlagsBits.SendMessages.toString()]: "SendMessages",
    [PermissionFlagsBits.EmbedLinks.toString()]: "EmbedLinks",
    [PermissionFlagsBits.AttachFiles.toString()]: "AttachFiles",
    [PermissionFlagsBits.ManageMessages.toString()]: "ManageMessages",
  };

  for (const perm of required) {
    if (!botPermissions.has(perm)) {
      missing.push(permNameMap[perm.toString()] || "Unknown");
    }
  }

  return missing;
}

function buildLanguageStep(
  t: (key: string, options?: Record<string, unknown>) => string,
  state: SetupWizardState,
): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[];
} {
  const localeEntries = Array.from(locales.entries());
  const totalPages = Math.ceil(localeEntries.length / LOCALES_PER_PAGE);
  const startIdx = state.languagePage * LOCALES_PER_PAGE;
  const pageLocales = localeEntries.slice(startIdx, startIdx + LOCALES_PER_PAGE);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t("commands.setup.step_language_title"))
    .setDescription(t("commands.setup.step_language_description"));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("setup_language")
    .setPlaceholder(t("commands.setup.language_placeholder"))
    .addOptions(
      pageLocales.map(([code, data]) => ({
        label: data._language_name || code,
        value: code,
      })),
    );

  const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
  ];

  // Add pagination if needed
  if (totalPages > 1) {
    embed.setFooter({
      text: t("commands.setup.language_page_info", {
        current: state.languagePage + 1,
        total: totalPages,
      }),
    });

    const paginationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("setup_lang_prev")
        .setLabel("◀")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(state.languagePage === 0),
      new ButtonBuilder()
        .setCustomId("setup_lang_next")
        .setLabel("▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(state.languagePage >= totalPages - 1),
    );
    components.push(paginationRow);
  }

  return { embed, components };
}

function buildChannelStep(t: (key: string, options?: Record<string, unknown>) => string): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ChannelSelectMenuBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t("commands.setup.step_channel_title"))
    .setDescription(t("commands.setup.step_channel_description"));

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("setup_channel")
    .setPlaceholder(t("commands.setup.channel_placeholder"))
    .setChannelTypes(ChannelType.GuildText);

  return {
    embed,
    components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect)],
  };
}

function buildNotificationStep(t: (key: string, options?: Record<string, unknown>) => string): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<StringSelectMenuBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t("commands.setup.step_notification_title"))
    .setDescription(t("commands.setup.step_notification_description"));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("setup_notification")
    .setPlaceholder(t("commands.setup.notification_placeholder"))
    .addOptions([
      {
        label: t("commands.setup.notification_option_pin_edit"),
        value: "pin-edit",
        description: t("commands.setup.notification_option_pin_edit_desc"),
      },
      {
        label: t("commands.setup.notification_option_post_delete"),
        value: "post-delete",
        description: t("commands.setup.notification_option_post_delete_desc"),
      },
      {
        label: t("commands.setup.notification_option_post_keep"),
        value: "post-keep",
        description: t("commands.setup.notification_option_post_keep_desc"),
      },
    ]);

  return {
    embed,
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
  };
}

function buildPermissionErrorStep(
  t: (key: string, options?: Record<string, unknown>) => string,
  channelMention: string,
  missingPerms: string[],
): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
  const permissionsList = missingPerms
    .map((perm) => `• ${t(`commands.setup.${PERMISSION_NAMES[perm]}`) || perm}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(t("commands.setup.permission_error_title"))
    .setDescription(
      t("commands.setup.permission_error_description", {
        channel: channelMention,
        permissions: permissionsList,
      }),
    );

  const recheckButton = new ButtonBuilder()
    .setCustomId("setup_recheck_perms")
    .setLabel(t("commands.setup.recheck_button"))
    .setStyle(ButtonStyle.Primary)
    .setEmoji("🔄");

  return {
    embed,
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(recheckButton)],
  };
}

function buildMobileStep(t: (key: string, options?: Record<string, unknown>) => string): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t("commands.setup.step_mobile_title"))
    .setDescription(
      `${t("commands.setup.step_mobile_description")}\n\n${t("commands.setup.step_mobile_disclaimer")}`,
    );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("setup_mobile")
    .setPlaceholder(t("commands.setup.mobile_placeholder"))
    .addOptions([
      { label: t("commands.setup.mobile_option_desktop"), value: "false" },
      { label: t("commands.setup.mobile_option_mobile"), value: "true" },
    ]);

  const skipButton = new ButtonBuilder()
    .setCustomId("setup_mobile_skip")
    .setLabel(t("commands.setup.skip_desktop"))
    .setStyle(ButtonStyle.Secondary);

  return {
    embed,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(skipButton),
    ],
  };
}

function buildCompleteStep(
  t: (key: string, options?: Record<string, unknown>) => string,
  state: SetupWizardState,
  channelName: string,
): { embed: EmbedBuilder } {
  const localeData = locales.get(state.locale);
  const languageName = localeData?._language_name || state.locale;

  const methodLabels: Record<NotificationMethod, string> = {
    "pin-edit": t("commands.setup.notification_option_pin_edit"),
    "post-delete": t("commands.setup.notification_option_post_delete"),
    "post-keep": t("commands.setup.notification_option_post_keep"),
  };

  const mobileLabel = state.mobileFriendly
    ? t("commands.setup.mobile_option_mobile")
    : t("commands.setup.mobile_option_desktop");

  const description = [
    t("commands.setup.complete_description"),
    "",
    t("commands.setup.complete_channel", { channel: `#${channelName}` }),
    t("commands.setup.complete_language", { language: languageName }),
    t("commands.setup.complete_notification", { method: methodLabels[state.notificationMethod!] }),
    t("commands.setup.complete_mobile", { mode: mobileLabel }),
    "",
    t("commands.setup.complete_footer"),
    "",
    t("commands.setup.complete_tip"),
  ].join("\n");

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(t("commands.setup.complete_title"))
    .setDescription(description);

  return { embed };
}

async function savePartialConfig(
  guildId: string,
  guildName: string,
  state: SetupWizardState,
): Promise<void> {
  if (state.channelId) {
    await setServerConfig(guildId, state.channelId, guildName);
    if (state.locale) {
      await setServerLocale(guildId, state.locale);
    }
    if (state.notificationMethod) {
      await setNotificationMethod(guildId, state.notificationMethod);
    }
  }
}

async function handleLanguagePagination(
  i: ButtonInteraction,
  ctx: WizardContext,
  direction: "prev" | "next",
): Promise<void> {
  if (direction === "prev") {
    ctx.state.languagePage = Math.max(0, ctx.state.languagePage - 1);
  } else {
    const totalPages = Math.ceil(locales.size / LOCALES_PER_PAGE);
    ctx.state.languagePage = Math.min(totalPages - 1, ctx.state.languagePage + 1);
  }
  const step = buildLanguageStep(ctx.t, ctx.state);
  await i.update({ embeds: [step.embed], components: step.components });
}

async function handleLanguageSelection(
  i: StringSelectMenuInteraction,
  ctx: WizardContext,
): Promise<void> {
  ctx.state.locale = i.values[0];
  ctx.state.currentStep = "channel";
  ctx.updateT(ctx.state.locale);

  const step = buildChannelStep(ctx.t);
  await i.update({ embeds: [step.embed], components: step.components });
}

async function handleChannelSelection(
  i: ChannelSelectMenuInteraction,
  ctx: WizardContext,
): Promise<void> {
  ctx.state.channelId = i.values[0];
  ctx.state.currentStep = "notification";

  const step = buildNotificationStep(ctx.t);
  await i.update({ embeds: [step.embed], components: step.components });
}

async function handlePermissionCheck(
  i: StringSelectMenuInteraction | ButtonInteraction,
  ctx: WizardContext,
): Promise<void> {
  const channel = await ctx.guild.channels.fetch(ctx.state.channelId!);
  if (!channel || !channel.isTextBased()) {
    await i.update({
      content: ctx.t("commands.setup.save_error"),
      embeds: [],
      components: [],
    });
    ctx.collector.stop();
    return;
  }

  const missingPerms = getMissingPermissions(
    channel as GuildTextBasedChannel,
    ctx.state.notificationMethod!,
  );

  if (missingPerms.length > 0) {
    const step = buildPermissionErrorStep(ctx.t, `<#${ctx.state.channelId}>`, missingPerms);
    await i.update({ embeds: [step.embed], components: step.components });
  } else {
    ctx.state.currentStep = "mobile";
    const step = buildMobileStep(ctx.t);
    await i.update({ embeds: [step.embed], components: step.components });
  }
}

async function handleNotificationSelection(
  i: StringSelectMenuInteraction,
  ctx: WizardContext,
): Promise<void> {
  ctx.state.notificationMethod = i.values[0] as NotificationMethod;
  ctx.state.currentStep = "permissions";
  await handlePermissionCheck(i, ctx);
}

async function saveAndComplete(
  i: StringSelectMenuInteraction | ButtonInteraction,
  ctx: WizardContext,
): Promise<void> {
  try {
    await setServerConfig(ctx.guildId, ctx.state.channelId!, ctx.guildName);
    await setServerLocale(ctx.guildId, ctx.state.locale);
    await setNotificationMethod(ctx.guildId, ctx.state.notificationMethod!);
    if (ctx.state.mobileFriendly) {
      await setMobileFriendly(ctx.guildId, ctx.state.mobileFriendly);
    }

    const channel = await ctx.guild.channels.fetch(ctx.state.channelId!);
    const channelName = channel && "name" in channel ? channel.name : ctx.state.channelId!;

    const step = buildCompleteStep(ctx.t, ctx.state, channelName);
    await i.update({ embeds: [step.embed], components: [] });

    postOrUpdateInChannel(ctx.client, ctx.guildId, ctx.state.channelId!).catch((error) => {
      logger.error({ err: error }, "Failed to post initial update after setup");
    });

    ctx.collector.stop("complete");
  } catch (error) {
    logger.error({ err: error }, "Setup save failed");
    await i.update({
      content: ctx.t("commands.setup.save_error"),
      embeds: [],
      components: [],
    });
    ctx.collector.stop();
  }
}

async function handleMobileSelection(
  i: StringSelectMenuInteraction,
  ctx: WizardContext,
): Promise<void> {
  ctx.state.mobileFriendly = i.values[0] === "true";
  ctx.state.currentStep = "complete";
  await saveAndComplete(i, ctx);
}

async function handleMobileSkip(i: ButtonInteraction, ctx: WizardContext): Promise<void> {
  ctx.state.mobileFriendly = false;
  ctx.state.currentStep = "complete";
  await saveAndComplete(i, ctx);
}

const SetupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setNameLocalizations(nameLocalizations)
    .setDescription("Guided setup wizard to configure the bot for your server")
    .setDescriptionLocalizations(descriptionLocalizations)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as Command["data"],

  async execute(interaction: ChatInputCommandInteraction) {
    // Get current config for initial locale
    const config = interaction.guildId ? await getServerConfig(interaction.guildId) : null;
    const initialLocale = config?.locale || interaction.guild?.preferredLocale || "en";
    let t = getT(initialLocale);

    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: t("common.only_in_guild"),
        flags: Number(MessageFlags.Ephemeral),
      });
      return;
    }

    await interaction.deferReply({ flags: Number(MessageFlags.Ephemeral) });

    const guildId = interaction.guildId;
    const guildName = interaction.guild.name;

    const state: SetupWizardState = {
      locale: initialLocale,
      currentStep: "language",
      languagePage: 0,
    };

    // Step 1: Language Selection
    const { embed, components } = buildLanguageStep(t, state);
    const message = await interaction.editReply({ embeds: [embed], components });

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: STEP_TIMEOUT,
    });

    let collectorEnded = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const resetTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!collectorEnded) {
          collector.stop("timeout");
        }
      }, STEP_TIMEOUT);
    };

    resetTimeout();

    // Create context for handlers
    const ctx: WizardContext = {
      state,
      t,
      guild: interaction.guild,
      guildId,
      guildName,
      client: interaction.client,
      collector,
      updateT: (locale: string) => {
        t = getT(locale);
        ctx.t = t;
      },
    };

    collector.on("collect", async (i) => {
      try {
        resetTimeout();

        if (i.customId === "setup_lang_prev" && i.isButton()) {
          await handleLanguagePagination(i, ctx, "prev");
        } else if (i.customId === "setup_lang_next" && i.isButton()) {
          await handleLanguagePagination(i, ctx, "next");
        } else if (i.customId === "setup_language" && i.isStringSelectMenu()) {
          await handleLanguageSelection(i, ctx);
        } else if (i.customId === "setup_channel" && i.isChannelSelectMenu()) {
          await handleChannelSelection(i, ctx);
        } else if (i.customId === "setup_notification" && i.isStringSelectMenu()) {
          await handleNotificationSelection(i, ctx);
        } else if (i.customId === "setup_recheck_perms" && i.isButton()) {
          await handlePermissionCheck(i, ctx);
        } else if (i.customId === "setup_mobile" && i.isStringSelectMenu()) {
          await handleMobileSelection(i, ctx);
        } else if (i.customId === "setup_mobile_skip" && i.isButton()) {
          await handleMobileSkip(i, ctx);
        }
      } catch (error) {
        logger.error({ err: error }, "Error in setup wizard collector");
      }
    });

    collector.on("end", async (_, reason) => {
      collectorEnded = true;
      if (timeoutId) clearTimeout(timeoutId);

      if (reason === "complete") {
        return;
      }

      if (reason === "timeout" || reason === "time") {
        try {
          if (state.channelId && state.notificationMethod) {
            // Save partial config
            await savePartialConfig(guildId, guildName, state);
            await interaction.editReply({
              content: t("commands.setup.timeout_partial", { channel: `<#${state.channelId}>` }),
              embeds: [],
              components: [],
            });
          } else {
            await interaction.editReply({
              content: t("commands.setup.timeout"),
              embeds: [],
              components: [],
            });
          }
        } catch (error) {
          logger.error({ err: error }, "Error handling setup timeout");
        }
      }
    });
  },
};

module.exports = SetupCommand;
