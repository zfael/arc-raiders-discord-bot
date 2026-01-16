import * as fs from "node:fs";
import * as path from "node:path";
import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import type { Command } from "./types";
import { logger } from "./utils/logger";

config();

const TEST_GUILD_ID = process.env.TEST_GUILD_ID;

if (!TEST_GUILD_ID) {
  logger.error("TEST_GUILD_ID environment variable is required");
  process.exit(1);
}

const commands: unknown[] = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath) as Command;
  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    logger.info(`Deploying ${commands.length} commands to guild ${TEST_GUILD_ID}...`);

    const data = (await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID!, TEST_GUILD_ID),
      { body: commands },
    )) as unknown[];

    logger.info(`Successfully registered ${data.length} guild commands (instant update).`);
  } catch (error) {
    logger.error({ err: error }, "Error deploying guild commands");
  }
})();
