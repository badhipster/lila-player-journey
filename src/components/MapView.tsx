"use client";

/**
 * MapView — wraps MapCanvas with next/dynamic({ ssr: false }) so Konva (which
 * touches `window`) only loads on the client. Also owns:
 *   • Legend overlay (top-right, anchored on the canvas)
 *   • Hover tooltip — when MapCanvas raises an onMarkerHover event, render an
 *     HTML overlay near the marker showing event/player/timestamp.
 */

import dynamic from "next/dynamic";
import { useState } from "react";

import type { MapId } from "@/lib/coordinates";
import type { MarkerEvent, MatchPaths } from "@/lib/types";
import type { HeatmapConfig } from "./MapCanvas";
import Legend from "./Legend";
import type { HeatmapMode } from "./FilterPanel";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[800px] w-[800px] items-center justify-center rounded-lg bg-neutral-900 text-sm text-neutral-500">
      Loading canvas…
    </div>
  ),
});

interface Props {
  mapId: MapId;
  events: MarkerEvent[];
  paths?: MatchPaths | null;
  tCutoff?: number | null;
  heatmap?: HeatmapConfig | null;
  heatmapMode: HeatmapMode;
  displaySize?: number;
}

export interface HoverState {
  event: MarkerEvent;
  x: number;
  y: number;
}

const EVENT_LABEL: Record<MarkerEvent["event"], string> = {
  Kill: "Killed another human",
  Killed: "Killed by another human",
  BotKill: "Killed a bot",
  BotKilled: "Killed by a bot",
  Loot: "Looted item",
  KilledByStorm: "Died to storm",
};

export default function MapView({
  displaySize = 800,
  heatmapMode,
  ...props
}: Props) {
  const [hover, setHover] = useState<HoverState | null>(null);

  return (
    <div
      className="relative inline-block"
      style={{ width: displaySize, height: displaySize }}
    >
      <MapCanvas
        {...props}
        displaySize={displaySize}
        onMarkerHover={setHover}
      />

      <Legend heatmapMode={heatmapMode} />

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-neutral-700 bg-neutral-950/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur-sm"
          style={{
            left: clamp(hover.x + 14, 8, displaySize - 200),
            top: clamp(hover.y + 14, 8, displaySize - 110),
            minWidth: 180,
          }}
        >
          <div className="font-semibold text-neutral-100">
            {EVENT_LABEL[hover.event.event]}
          </div>
          <div className="mt-0.5 text-neutral-400">
            {hover.event.is_human ? "Human" : "Bot"} ·{" "}
            <span className="font-mono">
              {hover.event.user_id.slice(0, 8)}…
            </span>
          </div>
          <div className="mt-0.5 text-neutral-500">
            <span className="font-mono">
              x={hover.event.x.toFixed(1)}, z={hover.event.z.toFixed(1)}
            </span>
          </div>
          <div className="text-neutral-500">
            t = <span className="font-mono">{hover.event.t.toFixed(3)}</span> ·{" "}
            {hover.event.date.replace("February_", "Feb ")}
          </div>
          <div className="mt-0.5 text-neutral-600">
            match{" "}
            <span className="font-mono">
              {hover.event.match_id.slice(0, 8)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
