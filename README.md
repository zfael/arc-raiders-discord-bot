# Arc Raiders Discord Bot

A Discord bot that tracks and displays Arc Raiders map rotation conditions across all four maps (Dam, Buried City, Spaceport, and Blue Gate) with automatic hourly updates.

## Features

- 🗺️ **Automatic Map Rotation Tracking**: Updates every hour with current and next map conditions
- 📌 **Pinned Status Message**: Creates and maintains a pinned message with rich embed formatting
- 🕐 **UTC Schedule**: Follows the official Arc Raiders 24-hour UTC rotation schedule
- 🎨 **Visual Indicators**: Each condition type has unique emojis and colors
- ⚡ **Slash Commands**: Modern Discord interaction with `/ping` command for testing
- 💾 **Persistent State**: Remembers message IDs across bot restarts

## Map Conditions

The bot tracks these condition types across all maps:
- 🤖 Harvester
- 🌙 Night
- 💀 Husks
- 🌸 Blooms
- ⛈️ Storm
- 📦 Caches
- 🛸 Probes
- 🗼 Tower
- 🏰 Bunker
- ✅ None

## Prerequisites

- Node.js 18.x or higher
- npm or yarn
- A Discord Bot Token from [Discord Developer Portal](https://discord.com/developers/applications)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd arc-raiders-discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```
   
   Edit `.env` and fill in your values:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   ```

## Discord Bot Setup

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section and click "Add Bot"
4. Copy the bot token (this is your `DISCORD_TOKEN`)
5. Enable these Privileged Gateway Intents:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent

### 2. Bot Permissions

The bot requires these permissions (permission integer: **274877925376**):
- ✅ Send Messages
- ✅ Embed Links
- ✅ Manage Messages (for pinning)
- ✅ Read Message History

### 3. Invite the Bot

1. Go to OAuth2 > URL Generator in the Developer Portal
2. Select scopes: `bot` and `applications.commands`
3. Select the permissions listed above
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

### 4. Client ID

- **Client ID**: Found in the "General Information" section of your application.

## Usage

### Development Mode

Run the bot with hot reloading using ts-node:

```bash
npm run dev
```

### Deploy Slash Commands

Before first run or after adding new commands, deploy them:

```bash
npm run deploy-commands
```

This registers commands globally, which can take up to an hour to propagate to all servers.

### Production Mode

1. Build the TypeScript code:
   ```bash
   npm run build
   ```

2. Start the bot:
   ```bash
   npm start
   ```

## Commands

- `/ping` - Check bot latency and responsiveness.
- `/set-channel` - (Admin-only) Sets the channel where map rotation updates are posted.

## Project Structure

```
arc-raiders-discord-bot/
├── src/
│   ├── commands/           # Slash command definitions
│   │   └── ping.ts
│   ├── events/             # Discord event handlers
│   │   ├── ready.ts
│   │   └── interactionCreate.ts
│   ├── utils/              # Utility functions
│   │   ├── messageManager.ts
│   │   └── mapScheduler.ts
│   ├── config/             # Configuration files
│   │   └── mapRotation.ts  # 24-hour map schedule
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts
│   ├── data/               # Runtime data storage
│   │   └── messageIds.json
│   ├── index.ts            # Main entry point
│   └── deploy-commands.ts  # Command registration script
├── .env                    # Environment variables (not in git)
├── .env.example            # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Startup**: Bot logs in and immediately posts/updates the map rotation status
2. **Scheduling**: A cron job runs at the top of every hour (UTC)
3. **Updates**: The bot fetches current and next rotation from the 24-hour schedule
4. **Message Management**: 
   - If a message exists (from `messageIds.json`), it's edited
   - If not, a new message is created and pinned
   - Message ID is saved for future updates
5. **Persistence**: Message IDs are stored per channel, allowing the bot to resume updates after restarts

## Troubleshooting

### Bot doesn't respond to commands
- Make sure you ran `npm run deploy-commands`.
- Check that the bot has proper permissions in the server.
- Global commands can take up to an hour to update after being deployed.

### Map rotation message not appearing
- Use the `/set-channel` command to designate a channel for updates.
- Check the bot has "Send Messages", "Embed Links", and "Manage Messages" permissions in the designated channel.
- Look at the bot's console logs for any error messages.

### TypeScript errors
- Run `npm install` to ensure all dependencies are installed
- Check that Node.js version is 18.x or higher

### Bot crashes on startup
- Verify all required environment variables are set in `.env`
- Check that the Discord token is valid
- Ensure the bot is invited to the server

## License

MIT

## Contributing

Feel free to submit issues and pull requests!
