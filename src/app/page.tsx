"use client";

/**
 * Lila Player Journey — main page.
 *
 * Hour 3-5 minimum: map selector + canvas rendering all marker events for the
 * selected map. Filters / paths / heatmap / timeline are layered on in later
 * hours per _strategy/02_BUILD_PLAN.md.
 */

import { useEffect, useMemo, useState } from "react";

import MapView from "@/components/MapView";
import { MAP_CONFIGS, MapId } from "@/lib/coordinates";
import { loadEvents, loadMetadata } from "@/lib/data";
import type { MarkerEvent, Metadata } from "@/lib/types";

const MAP_IDS: MapId[] = ["AmbroseValley", "GrandRift", "Lockdown"];

export default function Home() {
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [events, setEvents] = useState<MarkerEvent[] | null>(null);
  const [mapId, setMapId] = useState<MapId>("AmbroseValley");
  const [error, setError] = useState<string | null>(null);

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

  const eventsForMap = useMemo(
    () => (events ?? []).filter((e) => e.map_id === mapId),
    [events, mapId],
  );

  const matchesForMap = useMemo(
    () => (meta?.matches ?? []).filter((m) => m.map_id === mapId),
    [meta, mapId],
  );

  return (
    <main className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Lila Player Journey
        </h1>
        <p className="text-sm text-neutral-400">
          Map-based exploration of player journeys, fights, loot, and storm
          deaths across LILA BLACK matches (Feb 10–14).
        </p>
      </header>

      {error ? (
        <div className="rounded border border-red-500/50 bg-red-950/40 p-4 text-sm text-red-300">
          Failed to load data: {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full max-w-xs space-y-4">
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-400">
              Map
            </label>
            <select
              value={mapId}
              onChange={(e) => setMapId(e.target.value as MapId)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            >
              {MAP_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-neutral-500">
              {MAP_CONFIGS[mapId].scale}m radius · origin (
              {MAP_CONFIGS[mapId].originX}, {MAP_CONFIGS[mapId].originZ})
            </p>
          </section>

          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-sm">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
              Dataset
            </h2>
            {meta ? (
              <ul className="space-y-1 text-neutral-300">
                <li>{meta.totals.files.toLocaleString()} parquet files</li>
                <li>{meta.totals.events.toLocaleString()} total events</li>
                <li>{meta.totals.markers.toLocaleString()} discrete markers</li>
                <li>{meta.totals.paths.toLocaleString()} matches</li>
                <li>{meta.totals.unique_players} unique players</li>
              </ul>
            ) : (
              <p className="text-neutral-500">Loading…</p>
            )}
          </section>

          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-sm">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
              Selected map
            </h2>
            <ul className="space-y-1 text-neutral-300">
              <li>{matchesForMap.length} matches</li>
              <li>{eventsForMap.length} markers</li>
            </ul>
          </section>
        </aside>

        {/* Canvas */}
        <div className="flex-1">
          <div className="inline-block">
            <MapView mapId={mapId} events={eventsForMap} />
          </div>
        </div>
      </div>
    </main>
  );
}
