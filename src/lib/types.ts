/**
 * JSON schemas produced by scripts/preprocess.py.
 * Keep in sync with the writer there.
 */

import type { MapId } from "./coordinates";

export type EventType =
  | "Kill"
  | "Killed"
  | "BotKill"
  | "BotKilled"
  | "KilledByStorm"
  | "Loot";

export interface MarkerEvent {
  user_id: string;
  match_id: string;
  map_id: MapId;
  date: string; // "February_10" etc.
  event: EventType;
  x: number;
  z: number;
  /** Match-relative time (seconds, normalized per match starting at 0). */
  t: number;
  is_human: boolean;
}

export interface PathPoint {
  x: number;
  z: number;
  t: number;
}

/** A sampled Position/BotPosition row used as the source for the Traffic heatmap. */
export interface SampledPosition {
  x: number;
  z: number;
  /** map_id */
  m: MapId;
  /** date (e.g. "February_10") */
  d: string;
  /** match_id */
  mid: string;
  /** is_human */
  h: boolean;
}

export interface PlayerPath {
  user_id: string;
  is_human: boolean;
  points: PathPoint[];
}

export interface MatchPaths {
  match_id: string;
  map_id: MapId;
  players: PlayerPath[];
}

export interface MapMeta {
  id: MapId;
  scale: number;
  origin_x: number;
  origin_z: number;
  minimap: string;
}

export interface MatchSummary {
  match_id: string;
  map_id: MapId;
  date: string;
  humans: number;
  bots: number;
  kills: number;
  storm_deaths: number;
  duration_s: number;
}

export interface Metadata {
  maps: MapMeta[];
  dates: string[];
  matches: MatchSummary[];
  totals: {
    files: number;
    events: number;
    markers: number;
    paths: number;
    unique_players: number;
  };
}
