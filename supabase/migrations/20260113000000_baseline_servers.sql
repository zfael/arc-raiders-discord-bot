-- Baseline migration: servers table
-- This represents the existing table structure as of 2026-01-13
-- Run this only if the table doesn't exist (fresh setup)

CREATE TABLE IF NOT EXISTS servers (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  server_name TEXT,
  message_id TEXT,
  last_updated TIMESTAMPTZ,
  mobile_friendly BOOLEAN DEFAULT FALSE,
  locale TEXT DEFAULT 'en',
  notification_method TEXT DEFAULT 'pin-edit' CHECK (notification_method IN ('pin-edit', 'post-delete', 'post-keep')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment to document the table
COMMENT ON TABLE servers IS 'Discord server configurations for the Arc Raiders bot';
COMMENT ON COLUMN servers.guild_id IS 'Discord guild/server ID (primary key)';
COMMENT ON COLUMN servers.channel_id IS 'Channel ID where map updates are posted';
COMMENT ON COLUMN servers.server_name IS 'Optional friendly name for the server';
COMMENT ON COLUMN servers.message_id IS 'ID of the pinned/last message for updates';
COMMENT ON COLUMN servers.last_updated IS 'Timestamp of last map update';
COMMENT ON COLUMN servers.mobile_friendly IS 'Whether to use mobile-friendly formatting';
COMMENT ON COLUMN servers.locale IS 'Language locale for messages';
COMMENT ON COLUMN servers.notification_method IS 'How map updates are delivered: pin-edit, post-delete, or post-keep';
