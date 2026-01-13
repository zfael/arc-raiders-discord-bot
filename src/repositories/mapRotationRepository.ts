import type { MapRotation } from "../types";
import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

const MAP_ROTATIONS_TABLE = "map_rotations";
const SYNC_METADATA_TABLE = "sync_metadata";

interface MapRotationRow {
  hour: number;
  dam_minor: string;
  dam_major: string;
  buried_city_minor: string;
  buried_city_major: string;
  spaceport_minor: string;
  spaceport_major: string;
  blue_gate_minor: string;
  blue_gate_major: string;
  stella_montis_minor: string;
  stella_montis_major: string;
  updated_at: string;
}

function rowToMapRotation(row: MapRotationRow): MapRotation {
  return {
    hour: row.hour,
    damMinor: row.dam_minor,
    damMajor: row.dam_major,
    buriedCityMinor: row.buried_city_minor,
    buriedCityMajor: row.buried_city_major,
    spaceportMinor: row.spaceport_minor,
    spaceportMajor: row.spaceport_major,
    blueGateMinor: row.blue_gate_minor,
    blueGateMajor: row.blue_gate_major,
    stellaMontisMinor: row.stella_montis_minor,
    stellaMontisMajor: row.stella_montis_major,
  };
}

function mapRotationToRow(rotation: MapRotation): Omit<MapRotationRow, "updated_at"> {
  return {
    hour: rotation.hour,
    dam_minor: rotation.damMinor,
    dam_major: rotation.damMajor,
    buried_city_minor: rotation.buriedCityMinor,
    buried_city_major: rotation.buriedCityMajor,
    spaceport_minor: rotation.spaceportMinor,
    spaceport_major: rotation.spaceportMajor,
    blue_gate_minor: rotation.blueGateMinor,
    blue_gate_major: rotation.blueGateMajor,
    stella_montis_minor: rotation.stellaMontisMinor,
    stella_montis_major: rotation.stellaMontisMajor,
  };
}

export async function getAllRotations(): Promise<MapRotation[]> {
  const { data, error } = await supabase
    .from(MAP_ROTATIONS_TABLE)
    .select("*")
    .order("hour", { ascending: true });

  if (error) {
    logger.error({ err: error }, "Failed to fetch map rotations from database");
    throw error;
  }

  return (data as MapRotationRow[]).map(rowToMapRotation);
}

export async function getRotationByHour(hour: number): Promise<MapRotation | null> {
  const { data, error } = await supabase
    .from(MAP_ROTATIONS_TABLE)
    .select("*")
    .eq("hour", hour)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, `Failed to fetch rotation for hour ${hour}`);
    throw error;
  }

  return data ? rowToMapRotation(data as MapRotationRow) : null;
}

export async function upsertRotations(rotations: MapRotation[]): Promise<void> {
  const rows = rotations.map(mapRotationToRow);

  const { error } = await supabase.from(MAP_ROTATIONS_TABLE).upsert(rows, {
    onConflict: "hour",
  });

  if (error) {
    logger.error({ err: error }, "Failed to upsert map rotations");
    throw error;
  }

  logger.info(`Upserted ${rotations.length} map rotations to database`);
}

export async function getSyncMetadata(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(SYNC_METADATA_TABLE)
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, `Failed to fetch sync metadata: ${key}`);
    throw error;
  }

  return data?.value ?? null;
}

export async function setSyncMetadata(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from(SYNC_METADATA_TABLE)
    .upsert({ key, value }, { onConflict: "key" });

  if (error) {
    logger.error({ err: error }, `Failed to set sync metadata: ${key}`);
    throw error;
  }
}

export async function getRotationsHash(): Promise<string | null> {
  return getSyncMetadata("map_rotations_hash");
}

export async function setRotationsHash(hash: string): Promise<void> {
  return setSyncMetadata("map_rotations_hash", hash);
}

export async function setLastSyncStatus(status: string): Promise<void> {
  await setSyncMetadata("last_sync_status", status);
  await setSyncMetadata("last_sync_at", new Date().toISOString());
}
