-- Migration: Add map_rotations and sync_metadata tables
-- For automated Google Sheets sync feature

-- Map rotations table: stores the 24-hour rotation schedule
CREATE TABLE map_rotations (
  hour INTEGER PRIMARY KEY CHECK (hour >= 0 AND hour < 24),
  dam_minor TEXT NOT NULL DEFAULT 'None',
  dam_major TEXT NOT NULL DEFAULT 'None',
  buried_city_minor TEXT NOT NULL DEFAULT 'None',
  buried_city_major TEXT NOT NULL DEFAULT 'None',
  spaceport_minor TEXT NOT NULL DEFAULT 'None',
  spaceport_major TEXT NOT NULL DEFAULT 'None',
  blue_gate_minor TEXT NOT NULL DEFAULT 'None',
  blue_gate_major TEXT NOT NULL DEFAULT 'None',
  stella_montis_minor TEXT NOT NULL DEFAULT 'None',
  stella_montis_major TEXT NOT NULL DEFAULT 'None',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync metadata table: stores hash and sync status
CREATE TABLE sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update trigger for map_rotations.updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_map_rotations_updated_at
  BEFORE UPDATE ON map_rotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_metadata_updated_at
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE map_rotations IS '24-hour map rotation schedule synced from Google Sheets';
COMMENT ON TABLE sync_metadata IS 'Metadata for sync operations (hash, timestamps)';
COMMENT ON COLUMN map_rotations.hour IS 'UTC hour (0-23)';
COMMENT ON COLUMN sync_metadata.key IS 'Metadata key (e.g., map_rotations_hash)';
COMMENT ON COLUMN sync_metadata.value IS 'Metadata value (e.g., SHA256 hash)';

-- Seed initial 24 hours with defaults (will be populated by sync job)
INSERT INTO map_rotations (hour) VALUES
  (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11),
  (12), (13), (14), (15), (16), (17), (18), (19), (20), (21), (22), (23)
ON CONFLICT (hour) DO NOTHING;

-- Initialize sync metadata
INSERT INTO sync_metadata (key, value) VALUES
  ('map_rotations_hash', ''),
  ('last_sync_at', ''),
  ('last_sync_status', 'pending')
ON CONFLICT (key) DO NOTHING;
