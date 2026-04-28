"use client";

/**
 * FilterPanel — sidebar UI that owns the visible filters:
 *   • Map (dropdown, single-select)
 *   • Date (dropdown, single-select with "All")
 *   • Match (cascades from map+date, "All" by default)
 *   • Event types (multi-toggle chips for the 6 marker categories)
 *
 * State is hoisted into the page so other components (canvas, heatmap,
 * timeline) can react to the same filters without re-deriving them.
 */

import { useMemo } from "react";

import { MapId } from "@/lib/coordinates";
import type { EventType, MatchSummary, Metadata } from "@/lib/types";

export type HeatmapMode = "off" | "traffic" | "kills" | "deaths";

export const ALL_EVENT_TYPES: EventType[] = [
  "Kill",
  "Killed",
  "BotKill",
  "BotKilled",
  "Loot",
  "KilledByStorm",
];

const EVENT_LABELS: Record<EventType, string> = {
  Kill: "Kill (PvP)",
  Killed: "Killed (PvP)",
  BotKill: "Bot kill",
  BotKilled: "Killed by bot",
  Loot: "Loot",
  KilledByStorm: "Storm death",
};

const EVENT_DOT_COLOR: Record<EventType, string> = {
  Kill: "#ef4444",
  Killed: "#0a0a0a",
  BotKill: "#f97316",
  BotKilled: "#7f1d1d",
  Loot: "#facc15",
  KilledByStorm: "#a855f7",
};

const MAP_OPTIONS: { id: MapId; label: string }[] = [
  { id: "AmbroseValley", label: "Ambrose Valley" },
  { id: "GrandRift", label: "Grand Rift" },
  { id: "Lockdown", label: "Lockdown" },
];

const DATE_LABELS: Record<string, string> = {
  February_10: "Feb 10",
  February_11: "Feb 11",
  February_12: "Feb 12",
  February_13: "Feb 13",
  February_14: "Feb 14 (partial)",
};

interface Props {
  meta: Metadata | null;
  mapId: MapId;
  dateFilter: string; // "all" | "February_10" | …
  matchFilter: string; // "all" | match_id
  enabledEventTypes: Set<EventType>;
  heatmapMode: HeatmapMode;
  onMapChange: (id: MapId) => void;
  onDateChange: (date: string) => void;
  onMatchChange: (matchId: string) => void;
  onEventTypesChange: (next: Set<EventType>) => void;
  onHeatmapModeChange: (mode: HeatmapMode) => void;
}

export default function FilterPanel({
  meta,
  mapId,
  dateFilter,
  matchFilter,
  enabledEventTypes,
  heatmapMode,
  onMapChange,
  onDateChange,
  onMatchChange,
  onEventTypesChange,
  onHeatmapModeChange,
}: Props) {
  // Cascade: matches available for current map (+ optional date filter),
  // sorted by total kills desc so the "interesting" matches sit on top.
  const cascadingMatches = useMemo<MatchSummary[]>(() => {
    if (!meta) return [];
    return meta.matches
      .filter((m) => m.map_id === mapId)
      .filter((m) => dateFilter === "all" || m.date === dateFilter)
      .sort(
        (a, b) =>
          b.kills - a.kills ||
          b.humans - a.humans ||
          b.duration_s - a.duration_s,
      );
  }, [meta, mapId, dateFilter]);

  const dates = meta?.dates ?? [];

  const toggleEventType = (t: EventType) => {
    const next = new Set(enabledEventTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    onEventTypesChange(next);
  };

  const allOn = enabledEventTypes.size === ALL_EVENT_TYPES.length;

  const setAll = (on: boolean) =>
    onEventTypesChange(on ? new Set(ALL_EVENT_TYPES) : new Set());

  return (
    <div className="space-y-4">
      {/* Map */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <Label>Map</Label>
        <select
          value={mapId}
          onChange={(e) => onMapChange(e.target.value as MapId)}
          className={selectClass}
        >
          {MAP_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </section>

      {/* Date */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <Label>Date</Label>
        <select
          value={dateFilter}
          onChange={(e) => onDateChange(e.target.value)}
          className={selectClass}
        >
          <option value="all">All 5 days</option>
          {dates.map((d) => (
            <option key={d} value={d}>
              {DATE_LABELS[d] ?? d}
            </option>
          ))}
        </select>
      </section>

      {/* Match */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex items-center justify-between">
          <Label>Match</Label>
          <span className="text-[10px] text-neutral-500">
            {cascadingMatches.length} on this map
          </span>
        </div>
        <select
          value={matchFilter}
          onChange={(e) => onMatchChange(e.target.value)}
          className={selectClass}
        >
          <option value="all">All matches (aggregate)</option>
          {cascadingMatches.map((m) => (
            <option
              key={m.match_id}
              value={m.match_id}
              title={`Match ${m.match_id} — ${DATE_LABELS[m.date] ?? m.date} · ${m.humans} human(s) · ${m.bots} bot file(s) · ${m.kills} kill(s)${m.storm_deaths ? ` · ${m.storm_deaths} storm death(s)` : ""}`}
            >
              {m.match_id.slice(0, 8)} · {DATE_LABELS[m.date] ?? m.date} · 👤{" "}
              {m.humans} · 🤖 {m.bots} · ☠ {m.kills}
              {m.storm_deaths ? ` · ⚡ ${m.storm_deaths}` : ""}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] leading-snug text-neutral-500">
          <span className="text-neutral-300">Format:</span> id · date · 👤
          humans · 🤖 bots · ☠ kills · ⚡ storm-deaths.
        </p>
        <p className="mt-1 text-[11px] leading-snug text-neutral-500">
          Sorted by total kills. Pick a match to enable paths + timeline.
        </p>
      </section>

      {/* Heatmap */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <Label>Heatmap</Label>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {(
            [
              { id: "off", label: "Off" },
              { id: "traffic", label: "Traffic" },
              { id: "kills", label: "Kill zones" },
              { id: "deaths", label: "Death zones" },
            ] as { id: HeatmapMode; label: string }[]
          ).map((m) => {
            const active = heatmapMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onHeatmapModeChange(m.id)}
                className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                    : "border-neutral-800 bg-transparent text-neutral-500 hover:border-neutral-700"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-neutral-500">
          Traffic uses sampled position data. Kills / Deaths use the discrete
          marker events you have shown.
        </p>
      </section>

      {/* Event types */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex items-center justify-between">
          <Label>Event types</Label>
          <button
            onClick={() => setAll(!allOn)}
            className="text-[10px] text-neutral-400 hover:text-neutral-200"
          >
            {allOn ? "Hide all" : "Show all"}
          </button>
        </div>
        <ul className="space-y-1.5">
          {ALL_EVENT_TYPES.map((t) => {
            const on = enabledEventTypes.has(t);
            return (
              <li key={t}>
                <button
                  onClick={() => toggleEventType(t)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                    on
                      ? "border-neutral-600 bg-neutral-800 text-neutral-100"
                      : "border-neutral-800 bg-transparent text-neutral-500 hover:border-neutral-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-neutral-600"
                      style={{ backgroundColor: EVENT_DOT_COLOR[t] }}
                    />
                    {EVENT_LABELS[t]}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {on ? "shown" : "hidden"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

const selectClass =
  "mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
      {children}
    </label>
  );
}
