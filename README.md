# Arc Raiders Discord Bot

[![Build & Lint](https://github.com/zfael/arc-raiders-discord-bot/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/zfael/arc-raiders-discord-bot/actions/workflows/build.yml)

A feature-rich Discord bot that tracks and displays Arc Raiders map rotation conditions across all five maps (Dam, Buried City, Spaceport, Blue Gate, and Stella Montis) with automatic hourly updates, interactive navigation, and visual map generation.

## Add the Bot to Your Server

You can invite Arc Raiders Discord Bot to any Discord server using this link:

[Add Arc Raiders Bot to your server](https://discord.com/oauth2/authorize?client_id=1442592163983528056)

**How to use after inviting:**

1. **Invite the bot** using the link above and authorize it for your server.
2. **Set the update channel** by using the `/set-channel` slash command in the channel where you want map rotation updates to appear. Only server admins can use this command.
   - Optional: Provide the `role` option to mention a role on the initial post created by `/set-channel`.
3. The bot will automatically post and update the Arc Raiders map rotation status every hour in the designated channel.
4. **(Optional)** Use `/settings mobile-friendly: True` to enable mobile-optimized display mode.

If you need to change the update channel, simply run `/set-channel` again in a different channel.

## Features

### Core Features
- **Automatic Map Rotation Tracking**: Updates every hour with current and next map conditions
- **Pinned Status Message**: Creates and maintains a pinned message with rich embed formatting
- **UTC Schedule**: Follows the official Arc Raiders 24-hour UTC rotation schedule
- **Visual Map Generation**: Generates beautiful map images with event overlays using Puppeteer
- **Persistent State**: Remembers message IDs and settings across bot restarts

### Interactive Features
- **Interactive Navigation**: Navigate through maps and events using button controls
- **Event Filtering**: View all maps, filter by major events, or filter by minor events
- **Interaction Priority System**: 15-second exclusive interaction locks to prevent conflicts
- **Mobile-Friendly Mode**: Optimized single-column layout for mobile devices
- **Live Countdown**: Real-time countdown to next rotation

### Map Coverage
Tracks conditions across all **5 maps**:
- Dam
- Buried City
- Spaceport
- Blue Gate
- Stella Montis

## Map Conditions & Events

The bot tracks these condition types across all maps:

### Major Events (2x Multiplier)
- **Harvester** - High-value target
- **Night** - Darkness conditions
- **Husks** - Enemy encounters
- **Blooms** - Lush vegetation
- **Storm** - Electrical hazards
- **Tower** - Space tower loot
- **Bunker** - Bunker access
- **Matriarch** - Boss encounter

### Minor Events
- **Caches** - Loot caches
- **Probes** - Probe spawns

### Status
- **None** - No active events

## Prerequisites

- Docker and Docker Compose (for Docker installation)
- OR Node.js 24.x or higher (for manual installation)
- A Discord Bot Token from [Discord Developer Portal](https://discord.com/developers/applications)
- Supabase project URL and Service Role key (used for persisting server/message metadata)

## Installation

### Option 1: Docker (Recommended)

The easiest way to run the bot is using Docker. Pre-built multi-architecture images are available on GitHub Container Registry.

#### Using Docker Compose

1. **Create a `.env` file** with your configuration:

   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   LOG_LEVEL=info
   PORT=6767
   ```

2. **Create a `docker-compose.yml` file**:

   ```yaml
   version: '3.8'

   services:
     arc-raiders-bot:
       image: ghcr.io/zfael/arc-raiders-discord-bot:latest
       container_name: arc-raiders-discord-bot
       restart: unless-stopped
       env_file:
         - .env
       ports:
         - "6767:6767"
       environment:
         - TZ=UTC
   ```

3. **Start the bot**:

   ```bash
   docker-compose up -d
   ```

4. **View logs**:

   ```bash
   docker-compose logs -f
   ```

5. **Stop the bot**:

   ```bash
   docker-compose down
   ```

#### Using Docker Run

Alternatively, run directly with Docker:

```bash
docker run -d \
  --name arc-raiders-discord-bot \
  --restart unless-stopped \
  -p 6767:6767 \
  --env-file .env \
  ghcr.io/zfael/arc-raiders-discord-bot:latest
```

#### Available Image Tags

- `latest` - Latest stable release from main branch
- `v1.0.0` - Specific version tags
- `main` - Latest commit on main branch (may be unstable)

#### Multi-Architecture Support

Images are built for both:
- `linux/amd64` (x86_64 / Intel/AMD)
- `linux/arm64` (ARM64 / Apple Silicon / Raspberry Pi)

Docker will automatically pull the correct architecture for your system.

### Option 2: Manual Installation

If you prefer to run without Docker:

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
   cp .env.example .env
   ```

   Edit `.env` and fill in your values:

   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
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

### 2. Upload Custom Emojis

1. Go to your application's "Emojis" section in the Developer Portal
2. Upload the emoji images from `src/assets/` directory:
   - `harvester.png`
   - `nightraid.png`
   - `husks.png`
   - `lush.png` (for Blooms)
   - `electro.png` (for Storm)
   - `cache.png`
   - `probe.png`
   - `spacetower_loot.png` (for Tower)
   - `bunker.png`
   - `matriarch.png`
3. Copy each emoji ID and update `CONDITION_EMOJIS` in `src/config/mapRotation.ts`

### 3. Bot Permissions

The bot requires these permissions (permission integer: **274877925376**):

- ✅ Send Messages
- ✅ Embed Links
- ✅ Manage Messages (for pinning)
- ✅ Read Message History
- ✅ Attach Files (for map images)

### 4. Invite the Bot

1. Go to OAuth2 > URL Generator in the Developer Portal
2. Select scopes: `bot` and `applications.commands`
3. Select the permissions listed above
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

### 5. Client ID

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

- `/ping` - Check bot latency and responsiveness
- `/set-channel` - (Admin-only) Sets the channel where map rotation updates are posted
- `/settings mobile-friendly: <True/False>` - (Admin-only) Toggle mobile-friendly display mode

## Interactive Controls

The bot's map rotation message includes interactive buttons:

### Navigation Buttons
- **🏠 Home** - Return to overview of all maps
- **🗺️ View Map** - See visual map with event overlays
- **⚔️ Major Events** - Filter to show only major events
- **📦 Minor Events** - Filter to show only minor events

### Interaction Priority System
- When you click a button, you gain **exclusive control** for **15 seconds**
- Other users will see an ephemeral message if they try to interact during this time
- After 15 seconds of inactivity, the message automatically returns to the home screen
- The message becomes available for anyone to interact with again

## Data Storage

All persistent state is stored in Supabase:

### `servers` Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `guild_id` | text (PK) | Discord server ID |
| `channel_id` | text | Channel for map updates |
| `server_name` | text | Server name for logging |
| `message_id` | text | ID of pinned message |
| `last_updated` | text | Last update timestamp |
| `mobile_friendly` | boolean | Mobile-friendly mode setting |
| `locale` | text | Language locale for translations |
| `ping_target` | text | Who to ping on initial `/set-channel` post: `none` \| `everyone` \| `role` |
| `ping_role_id` | text | Role ID to ping when `ping_target = role` |
| `notification_method` | text | How map updates are posted: `pin-edit` \| `post-delete` \| `post-keep` |
| `created_at` | timestamptz | Row creation time |
| `updated_at` | timestamptz | Last modification time |

The bot automatically manages this table. You can back up or inspect it directly in the Supabase dashboard. Deleting rows is safe; the bot will recreate them as needed.

## Supabase Setup

1. Create the required table (run once in the Supabase SQL editor):

   ```sql
   create table if not exists public.servers (
     guild_id text primary key,
     channel_id text not null,
     server_name text,
     message_id text,
     last_updated text,
     mobile_friendly boolean default false,
     locale text default 'en',
     ping_target text default 'none',
     ping_role_id text,
     notification_method text default 'pin-edit',
     created_at timestamptz default timezone('utc', now()),
     updated_at timestamptz default timezone('utc', now())
   );
   ```

2. (Optional) Enable Row Level Security and add permissive policies if you plan to use the anon key. The bot uses the `SUPABASE_SERVICE_ROLE_KEY`, so it can bypass policies by default.

3. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to your `.env`, matching the values in the Supabase dashboard.

## How It Works

### Startup & Scheduling
1. **Startup**: Bot logs in and immediately posts/updates the map rotation status
2. **Scheduling**: A cron job runs at the top of every hour (UTC) to update all server messages
3. **Updates**: The bot fetches current and next rotation from the 24-hour schedule

### Message Management
- Reads the stored `message_id` for each channel from Supabase
- Edits the existing pinned message or creates/pins a new one when needed
- Writes the latest `message_id`/`last_updated` back to Supabase
- Generates visual map images on-demand using Puppeteer

### Interactive System
- Button interactions are handled in `interactionCreate.ts`
- Interaction locks prevent multiple users from conflicting
- Locks expire after 15 seconds, reverting to home screen
- Ephemeral messages notify blocked users

### Persistence
Because configuration and message metadata live in Supabase, the bot resumes seamlessly after restarts.

## Visual Map Generation

The bot generates beautiful map images using:
- **Puppeteer**: Headless browser for HTML rendering
- **HTML Templates**: Custom templates with CSS styling
- **Base Map**: High-resolution map image (2690x1515px)
- **Event Overlays**: Dynamic markers showing active events at each location
- **Forecast Cards**: Upcoming rotation preview

Map coordinates are percentage-based for responsive scaling.

## Troubleshooting

### Bot doesn't respond to commands

- Make sure you ran `npm run deploy-commands`
- Check that the bot has proper permissions in the server
- Global commands can take up to an hour to update after being deployed

### Map rotation message not appearing

- Use the `/set-channel` command to designate a channel for updates
- Check the bot has "Send Messages", "Embed Links", "Attach Files", and "Manage Messages" permissions in the designated channel
- Look at the bot's console logs for any error messages

### Map images not generating

- Ensure Puppeteer dependencies are installed (may require additional system packages on Linux)
- Check that `src/assets/map.png` exists and is readable
- Verify sufficient disk space and memory for image generation

### Interactive buttons not working

- Ensure the bot has "Read Message History" permission
- Check console logs for interaction errors
- Verify the message hasn't been deleted or unpinned

### TypeScript errors

- Run `npm install` to ensure all dependencies are installed
- Check that Node.js version is 18.x or higher
- Run `npm run lint` to check for code issues

### Bot crashes on startup

- Verify all required environment variables are set in `.env`
- Check that the Discord token is valid
- Ensure the bot is invited to the server
- Verify Supabase credentials are correct

## Development

### Code Quality

This project uses [Biome.js](https://biomejs.dev/) for linting and formatting:

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

### Building

```bash
npm run build       # Compile TypeScript and copy assets
```

The build process:
1. Compiles TypeScript to JavaScript in `dist/`
2. Copies `templates/` and `assets/` to `dist/`

## License

MIT

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint:fix` to format code
5. Test your changes thoroughly
6. Submit a pull request

---

**Questions or Issues?** Open an issue on GitHub or join the discussion!
