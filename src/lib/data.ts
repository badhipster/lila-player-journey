/**
 * Static JSON loaders for the visualization tool.
 * All data is precomputed by scripts/preprocess.py and lives under public/data/.
 */

import type {
  MarkerEvent,
  MatchPaths,
  Metadata,
  SampledPosition,
} from "./types";

const BASE = "/data";

let metadataCache: Metadata | null = null;
let eventsCache: MarkerEvent[] | null = null;
let positionsCache: SampledPosition[] | null = null;
const pathsCache = new Map<string, MatchPaths>();

export async function loadMetadata(): Promise<Metadata> {
  if (metadataCache) return metadataCache;
  const res = await fetch(`${BASE}/metadata.json`);
  if (!res.ok) throw new Error(`metadata.json: ${res.status}`);
  metadataCache = (await res.json()) as Metadata;
  return metadataCache;
}

export async function loadEvents(): Promise<MarkerEvent[]> {
  if (eventsCache) return eventsCache;
  const res = await fetch(`${BASE}/events.json`);
  if (!res.ok) throw new Error(`events.json: ${res.status}`);
  eventsCache = (await res.json()) as MarkerEvent[];
  return eventsCache;
}

export async function loadPositionsSampled(): Promise<SampledPosition[]> {
  if (positionsCache) return positionsCache;
  const res = await fetch(`${BASE}/positions_sampled.json`);
  if (!res.ok) throw new Error(`positions_sampled.json: ${res.status}`);
  positionsCache = (await res.json()) as SampledPosition[];
  return positionsCache;
}

export async function loadMatchPaths(matchId: string): Promise<MatchPaths> {
  const cached = pathsCache.get(matchId);
  if (cached) return cached;
  const safe = encodeURIComponent(matchId);
  const res = await fetch(`${BASE}/paths/${safe}.json`);
  if (!res.ok) throw new Error(`paths/${matchId}: ${res.status}`);
  const data = (await res.json()) as MatchPaths;
  pathsCache.set(matchId, data);
  return data;
}
