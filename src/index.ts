import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { Client, Collection, GatewayIntentBits, MessageFlags } from "discord.js";
import { config } from "dotenv";
import type { Command, Event } from "./types";
import { logger } from "./utils/logger";
import { initScheduler } from "./utils/mapScheduler";
import { setupLockExpiration } from "./utils/messageManager";
import { setupRateLimitMonitoring } from "./utils/rateLimitMonitor";
import { patchDiscordRateLimiting } from "./utils/discordApiPatch";

// Load environment variables
config();
process.env.TZ = "UTC";

// Validate required environment variables
const requiredEnvVars = ["DISCORD_TOKEN", "CLIENT_ID"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Error: ${envVar} is not set in .env file`);
    process.exit(1);
  }
}

// Create Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Setup command collection
const commands = new Collection<string, Command>();

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath) as Command;
  if ("data" in command && "execute" in command) {
    commands.set(command.data.name, command);
    logger.info(`Loaded command: ${command.data.name}`);
  } else {
    logger.warn(`Warning: Command at ${filePath} is missing required "data" or "execute" property`);
  }
}

// Attach commands to client
client.commands = commands;

// Load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter(
    (file) => (file.endsWith(".ts") || file.endsWith(".js")) && !file.includes("interactionCreate"),
  );

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath) as Event;
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  logger.info(`Loaded event: ${String(event.name)}`);
}

// Initialize the map rotation scheduler
initScheduler(client);

// Setup message lock expiration handling
setupLockExpiration(client);

// Patch Discord REST client for automatic rate limit handling
patchDiscordRateLimiting(client);

// Setup rate limit monitoring
setupRateLimitMonitoring(client);

import { handleInteraction } from "./events/interactionCreate";

client.on("interactionCreate", async (interaction) => {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error({ err: error }, `Error executing command ${interaction.commandName}`);
      const errorMessage = {
        content: "There was an error while executing this command!",
        flags: Number(MessageFlags.Ephemeral),
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
    return;
  }

  // Handle button interactions
  await handleInteraction(interaction);
});

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down gracefully...");
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down gracefully...");
  client.destroy();
  process.exit(0);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

// Start health check server
const PORT = process.env.PORT || 6767;
const server = http.createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    const isReady = client.isReady();
    res.writeHead(isReady ? 200 : 503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: isReady ? "ok" : "not ready",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }),
    );
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  }
});

server.listen(PORT, () => {
  logger.info(`Health check server listening on port ${PORT}`);
});
