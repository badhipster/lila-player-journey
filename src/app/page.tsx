"use client";

/**
 * Lila Player Journey — main page.
 *
 * Layout (desktop ≥ lg):
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ header (kicker + title + subtitle)            stat pills      │
 *   ├────────────┬───────────────────────────────────┬─────────────┤
 *   │ left rail  │ canvas (square, adaptive)         │ right rail  │
 *   │ filters    │ timeline                          │ legend      │
 *   │            │ counts strip                      │ current read│
 *   │            │                                   │ match details│
 *   └────────────┴───────────────────────────────────┴─────────────┘
 *
 * Below `lg` everything stacks single-column.
 *
 * State graph:
 *   meta, events            ← loaded once from /data/{metadata,events}.json
 *   matchPaths              ← lazy fetch of /data/paths/{match_id}.json
 *   positions               ← lazy fetch of /data/positions_sampled.json
 *                              (only when Traffic heatmap selected)
 *   mapId, dateFilter,
 *   matchFilter,
 *   enabledEventTypes,
 *   heatmapMode,
 *   tCutoff                 ← user-controlled filters
 */

import { useEffect, useMemo, useState } from "react";

import CurrentRead from "@/components/CurrentRead";
import FilterPanel, {
  ALL_EVENT_TYPES,
  HeatmapMode,
} from "@/components/FilterPanel";
import Legend from "@/components/Legend";
import type { HeatmapConfig } from "@/components/MapCanvas";
import MapView from "@/components/MapView";
import Timeline, { TimelineMark } from "@/components/Timeline";
import { MapId } from "@/lib/coordinates";
import {
  loadEvents,
  loadMatchPaths,
  loadMetadata,
  loadPositionsSampled,
} from "@/lib/data";
import type {
  EventType,
  MarkerEvent,
  MatchPaths,
  Metadata,
  SampledPosition,
} from "@/lib/types";

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
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("traffic");

  const [matchPaths, setMatchPaths] = useState<MatchPaths | null>(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [positions, setPositions] = useState<SampledPosition[] | null>(null);
  const [tCutoff, setTCutoff] = useState<number>(0);

  // Load metadata + events once.
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

  // Lazy-load positions when Traffic mode is first activated.
  useEffect(() => {
    if (heatmapMode !== "traffic" || positions !== null) return;
    let cancelled = false;
    loadPositionsSampled()
      .then((p) => !cancelled && setPositions(p))
      .catch((err) => !cancelled && setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, [heatmapMode, positions]);

  // Reset match selection when map/date changes.
  useEffect(() => {
    setMatchFilter("all");
  }, [mapId, dateFilter]);

  // Lazily fetch path JSON when a single match is selected.
  useEffect(() => {
    if (matchFilter === "all") {
      setMatchPaths(null);
      setTCutoff(0);
      return;
    }
    let cancelled = false;
    setPathLoading(true);
    loadMatchPaths(matchFilter)
      .then((p) => {
        if (cancelled) return;
        setMatchPaths(p);
        let maxT = 0;
        for (const pl of p.players)
          for (const pt of pl.points) if (pt.t > maxT) maxT = pt.t;
        setTCutoff(maxT);
      })
      .catch((err) => !cancelled && setError(String(err)))
      .finally(() => !cancelled && setPathLoading(false));
    return () => {
      cancelled = true;
    };
  }, [matchFilter]);

  const matchTrueDuration = useMemo(() => {
    if (!matchPaths) return 0;
    let maxT = 0;
    for (const pl of matchPaths.players)
      for (const pt of pl.points) if (pt.t > maxT) maxT = pt.t;
    return maxT;
  }, [matchPaths]);

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

  // Heatmap config, filter-aware.
  const heatmapConfig = useMemo<HeatmapConfig | null>(() => {
    if (heatmapMode === "off") return null;

    if (heatmapMode === "traffic") {
      if (!positions) return null;
      const pts = positions
        .filter(
          (p) =>
            p.m === mapId &&
            (dateFilter === "all" || p.d === dateFilter) &&
            (matchFilter === "all" || p.mid === matchFilter),
        )
        .map((p) => ({ x: p.x, z: p.z }));
      return pts.length === 0
        ? null
        : { points: pts, mode: "traffic", radius: 14, blur: 18 };
    }

    if (heatmapMode === "kills") {
      const KILL_TYPES = new Set<EventType>(["Kill", "BotKill"]);
      const pts = (events ?? [])
        .filter(
          (e) =>
            e.map_id === mapId &&
            (dateFilter === "all" || e.date === dateFilter) &&
            (matchFilter === "all" || e.match_id === matchFilter) &&
            KILL_TYPES.has(e.event),
        )
        .map((e) => ({ x: e.x, z: e.z }));
      return pts.length === 0
        ? null
        : { points: pts, mode: "kills", radius: 22, blur: 26 };
    }

    if (heatmapMode === "deaths") {
      const DEATH_TYPES = new Set<EventType>([
        "Killed",
        "BotKilled",
        "KilledByStorm",
      ]);
      const pts = (events ?? [])
        .filter(
          (e) =>
            e.map_id === mapId &&
            (dateFilter === "all" || e.date === dateFilter) &&
            (matchFilter === "all" || e.match_id === matchFilter) &&
            DEATH_TYPES.has(e.event),
        )
        .map((e) => ({ x: e.x, z: e.z }));
      return pts.length === 0
        ? null
        : { points: pts, mode: "deaths", radius: 22, blur: 26 };
    }

    return null;
  }, [heatmapMode, positions, events, mapId, dateFilter, matchFilter]);

  const timelineMarks = useMemo<TimelineMark[]>(() => {
    if (matchFilter === "all" || !events) return [];
    const out: TimelineMark[] = [];
    for (const e of events) {
      if (e.match_id !== matchFilter) continue;
      let kind: TimelineMark["kind"];
      if (e.event === "Kill" || e.event === "BotKill") kind = "kill";
      else if (e.event === "Killed" || e.event === "BotKilled") kind = "death";
      else if (e.event === "KilledByStorm") kind = "storm";
      else if (e.event === "Loot") kind = "loot";
      else continue;
      out.push({ t: e.t, kind });
    }
    return out;
  }, [events, matchFilter]);

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

  const counts = useMemo(() => {
    let humans = 0;
    let bots = 0;
    const eventsForCount =
      matchFilter !== "all"
        ? filteredEvents.filter((e) => e.t <= tCutoff)
        : filteredEvents;
    for (const e of eventsForCount) {
      if (e.is_human) humans++;
      else bots++;
    }
    return { humans, bots, total: eventsForCount.length };
  }, [filteredEvents, matchFilter, tCutoff]);

  const matchSelected = matchFilter !== "all";

  return (
    <main className="min-h-screen px-6 py-5 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
            <span className="pulse-glow inline-block h-2 w-2 rounded-full bg-emerald-400" />
            LILA BLACK level design review
          </div>
          <h1 className="text-[28px] font-bold tracking-tight bg-gradient-to-r from-neutral-100 to-neutral-300 bg-clip-text text-transparent">
            Lila Player Journey
          </h1>
          <p className="mt-1 max-w-lg text-sm text-neutral-400">
            Map-based exploration of player journeys, fights, loot, and storm
            deaths across LILA BLACK matches (Feb 10–14).
          </p>
        </div>
        {meta ? (
          <div className="flex flex-wrap gap-2 text-xs text-neutral-400">
            <Pill>{meta.totals.files.toLocaleString()} files</Pill>
            <Pill>{meta.totals.events.toLocaleString()} events</Pill>
            <Pill>{meta.totals.paths.toLocaleString()} matches</Pill>
            <Pill>{meta.totals.unique_players} players</Pill>
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/50 bg-red-950/40 p-4 text-sm text-red-300">
          Failed to load data: {error}
        </div>
      ) : null}

      {/* 3-column workspace */}
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* Left rail — filters */}
        <aside className="lg:sticky lg:top-5 lg:self-start lg:max-h-[calc(100vh-40px)] lg:overflow-y-auto lg:pr-1">
          <FilterPanel
            meta={meta}
            mapId={mapId}
            dateFilter={dateFilter}
            matchFilter={matchFilter}
            enabledEventTypes={enabledEventTypes}
            heatmapMode={heatmapMode}
            onMapChange={setMapId}
            onDateChange={setDateFilter}
            onMatchChange={setMatchFilter}
            onEventTypesChange={setEnabledEventTypes}
            onHeatmapModeChange={setHeatmapMode}
          />
        </aside>

        {/* Middle — canvas + timeline + counts */}
        <div className="flex min-w-0 flex-col gap-4">
          <MapView
            mapId={mapId}
            events={filteredEvents}
            paths={matchPaths}
            tCutoff={matchSelected ? tCutoff : null}
            heatmap={heatmapConfig}
          />

          <Timeline
            duration={matchTrueDuration}
            value={tCutoff}
            onChange={setTCutoff}
            marks={timelineMarks}
            disabled={!matchSelected || pathLoading}
          />

          <div className="flex flex-wrap gap-3">
            <StatCard label="Markers shown" value={counts.total} />
            <StatCard
              label="Humans / Bots"
              value={`${counts.humans.toLocaleString()} / ${counts.bots.toLocaleString()}`}
            />
            <StatCard label="Matches on map" value={matchesForMap.length} />
            {matchPaths ? (
              <StatCard
                label="Players in match"
                value={matchPaths.players.length}
                sub={`${matchPaths.players.reduce(
                  (n, p) => n + p.points.length,
                  0,
                )} path points`}
              />
            ) : null}
          </div>
        </div>

        {/* Right rail — legend, narrative, match details */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-5 lg:self-start lg:max-h-[calc(100vh-40px)] lg:overflow-y-auto lg:pr-1">
          <Legend heatmapMode={heatmapMode} />
          <CurrentRead
            mapId={mapId}
            dateFilter={dateFilter}
            matchFilter={matchFilter}
            heatmapMode={heatmapMode}
            selectedMatch={selectedMatch}
            totalMarkers={counts.total}
            humans={counts.humans}
            bots={counts.bots}
            matchesOnMap={matchesForMap.length}
          />
          {selectedMatch ? (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-[12px] text-neutral-300">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                Selected match
              </div>
              <div className="font-mono text-[11px] text-neutral-200">
                {selectedMatch.match_id}
              </div>
              <ul className="mt-2 space-y-1 text-neutral-400">
                <li className="flex justify-between"><span>Date</span><span className="text-neutral-300">{selectedMatch.date.replace("February_", "Feb ")}</span></li>
                <li className="flex justify-between"><span>Humans</span><span className="text-neutral-300">{selectedMatch.humans}</span></li>
                <li className="flex justify-between"><span>Bot files</span><span className="text-neutral-300">{selectedMatch.bots}</span></li>
                <li className="flex justify-between"><span>Combat events</span><span className="text-neutral-300">{selectedMatch.kills}</span></li>
                <li className="flex justify-between"><span>Storm deaths</span><span className="text-neutral-300">{selectedMatch.storm_deaths}</span></li>
                <li className="flex justify-between"><span>Match clock</span><span className="font-mono text-neutral-300">{matchTrueDuration.toFixed(3)}</span></li>
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-700/50 bg-neutral-900/80 px-2.5 py-1 backdrop-blur-sm">
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
    <div className="min-w-[120px] flex-1 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm transition-colors hover:border-neutral-700">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold text-neutral-100">{value}</div>
      {sub ? <div className="mt-0.5 text-[10px] text-neutral-500">{sub}</div> : null}
    </div>
  );
}
