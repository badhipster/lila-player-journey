"use client";

/**
 * MapView — wraps MapCanvas with next/dynamic({ ssr: false }) so Konva (which
 * touches `window`) only loads on the client. Owns:
 *   • Adaptive canvas sizing — measures the available container width once on
 *     mount and re-measures on resize, snapping to a reasonable square.
 *   • Hover tooltip — when MapCanvas raises onMarkerHover, render an HTML
 *     overlay near the marker showing event/player/timestamp.
 *
 * Legend is no longer rendered here — it lives in the right rail to avoid
 * occluding named POI labels on Grand Rift / Lockdown minimaps.
 */

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { MapId } from "@/lib/coordinates";
import type { MarkerEvent, MatchPaths } from "@/lib/types";
import type { HeatmapConfig } from "./MapCanvas";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => null,
});

interface Props {
  mapId: MapId;
  events: MarkerEvent[];
  paths?: MatchPaths | null;
  tCutoff?: number | null;
  heatmap?: HeatmapConfig | null;
  /** Hard upper bound. Defaults to 1024 (the source minimap resolution). */
  maxSize?: number;
  /** Lower bound so things still feel useful on smaller screens. */
  minSize?: number;
}

interface HoverState {
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
  maxSize = 1024,
  minSize = 480,
  ...props
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  // Measure container width on mount + resize. The Stage is square, capped
  // by maxSize, floored by minSize, and quantised to whole pixels.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (!w) return;
      const next = Math.max(minSize, Math.min(maxSize, Math.floor(w)));
      setSize((prev) => (prev !== next ? next : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxSize, minSize]);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      style={{ aspectRatio: "1 / 1", maxHeight: maxSize }}
    >
      {size ? (
        <MapCanvas
          {...props}
          displaySize={size}
          onMarkerHover={setHover}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-900 text-sm text-neutral-500">
          Loading canvas…
        </div>
      )}

      {hover && size ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-neutral-700 bg-neutral-950/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur-sm"
          style={{
            left: clamp(hover.x + 14, 8, size - 200),
            top: clamp(hover.y + 14, 8, size - 110),
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
