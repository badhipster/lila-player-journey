"use client";

/**
 * Lila Player Journey — main page.
 *
 * State graph:
 *   meta, events            ← loaded once from /data/{metadata,events}.json
 *   mapId, dateFilter,
 *   matchFilter,
 *   enabledEventTypes       ← user-controlled filters
 *   selectedMatch           ← derived from matchFilter (object lookup)
 *
 * The canvas receives the already-filtered marker array, so MapCanvas stays
 * dumb — it just renders whatever events come in for whatever map.
 */

import { useEffect, useMemo, useState } from "react";

import FilterPanel, { ALL_EVENT_TYPES } from "@/components/FilterPanel";
import MapView from "@/components/MapView";
import { MAP_CONFIGS, MapId } from "@/lib/coordinates";
import { loadEvents, loadMetadata } from "@/lib/data";
import type { EventType, MarkerEvent, Metadata } from "@/lib/types";

const DEFAULT_MAP: MapId = "AmbroseValley";
const DEFAULT_DATE = "February_13"; // last full day per data/README

export default function Home() {
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [events, setEvents] = useState<MarkerEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mapId, setMapId] = useState<MapId>(DEFAULT_MAP);
  const [dateFilter, setDateFilter] = useState<string>(DEFAULT_DATE);
  const [matchFilter, setMatchFilter] = useState<string>("all");
  const [enabledEventTypes, setEnabledEventTypes] = useState<Set<EventType>>(
    new Set(ALL_EVENT_TYPES),
  );

  // Load data once.
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadMetadata(), loadEvents()])
      .then(([m, e]) => {
        if (cancelled) return;
        setMeta(m);
        setEvents(e);
      })
      .catch((err) => !cancelled && setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  // When map or date changes, reset the match filter — old match_id no longer
  // matches the cascade.
  useEffect(() => {
    setMatchFilter("all");
  }, [mapId, dateFilter]);

  const filteredEvents = useMemo<MarkerEvent[]>(() => {
    if (!events) return [];
    return events.filter(
      (e) =>
        e.map_id === mapId &&
        (dateFilter === "all" || e.date === dateFilter) &&
        (matchFilter === "all" || e.match_id === matchFilter) &&
        enabledEventTypes.has(e.event),
    );
  }, [events, mapId, dateFilter, matchFilter, enabledEventTypes]);

  const matchesForMap = useMemo(
    () => (meta?.matches ?? []).filter((m) => m.map_id === mapId),
    [meta, mapId],
  );

  const selectedMatch = useMemo(
    () =>
      matchFilter === "all"
        ? null
        : (meta?.matches.find((m) => m.match_id === matchFilter) ?? null),
    [meta, matchFilter],
  );

  // Counts to surface in the right rail.
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of ALL_EVENT_TYPES) out[t] = 0;
    let humans = 0;
    let bots = 0;
    for (const e of filteredEvents) {
      out[e.event] = (out[e.event] ?? 0) + 1;
      if (e.is_human) humans++;
      else bots++;
    }
    return { byType: out, humans, bots, total: filteredEvents.length };
  }, [filteredEvents]);

  return (
    <main className="min-h-screen p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Lila Player Journey
          </h1>
          <p className="text-sm text-neutral-400">
            Map-based exploration of player journeys, fights, loot, and storm
            deaths across LILA BLACK matches (Feb 10–14).
          </p>
        </div>
        {meta ? (
          <div className="flex gap-3 text-xs text-neutral-500">
            <Pill>{meta.totals.files.toLocaleString()} files</Pill>
            <Pill>{meta.totals.events.toLocaleString()} events</Pill>
            <Pill>{meta.totals.paths.toLocaleString()} matches</Pill>
            <Pill>{meta.totals.unique_players} players</Pill>
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="mb-4 rounded border border-red-500/50 bg-red-950/40 p-4 text-sm text-red-300">
          Failed to load data: {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full max-w-xs shrink-0">
          <FilterPanel
            meta={meta}
            mapId={mapId}
            dateFilter={dateFilter}
            matchFilter={matchFilter}
            enabledEventTypes={enabledEventTypes}
            onMapChange={setMapId}
            onDateChange={setDateFilter}
            onMatchChange={setMatchFilter}
            onEventTypesChange={setEnabledEventTypes}
          />
          <p className="mt-3 text-[11px] leading-snug text-neutral-500">
            {MAP_CONFIGS[mapId].scale}m radius · origin (
            {MAP_CONFIGS[mapId].originX}, {MAP_CONFIGS[mapId].originZ})
          </p>
        </aside>

        <div className="flex flex-1 flex-col gap-4">
          <div className="inline-block">
            <MapView mapId={mapId} events={filteredEvents} />
          </div>

          {/* Right rail / stats strip */}
          <div className="flex flex-wrap gap-3">
            <StatCard label="Markers shown" value={counts.total} />
            <StatCard
              label="Humans / Bots"
              value={`${counts.humans.toLocaleString()} / ${counts.bots.toLocaleString()}`}
            />
            <StatCard label="Matches on map" value={matchesForMap.length} />
            {selectedMatch ? (
              <StatCard
                label="Selected match"
                value={`${selectedMatch.humans}h · ${selectedMatch.bots}b · ${selectedMatch.kills}k`}
                sub={selectedMatch.match_id.slice(0, 12) + "…"}
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1">
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-base text-neutral-100">{value}</div>
      {sub ? <div className="text-[10px] text-neutral-500">{sub}</div> : null}
    </div>
  );
}
