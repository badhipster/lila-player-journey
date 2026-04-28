"use client";

/**
 * MapView — wraps MapCanvas with next/dynamic({ ssr: false }) so Konva (which
 * touches `window`) only loads on the client. Owns:
 *   • Adaptive canvas sizing — measures the available container width once on
 *     mount and re-measures on resize, snapping to a reasonable square.
 *   • Hover tooltip — when MapCanvas raises onMarkerHover, render an HTML
 *     overlay near the marker showing event/player/timestamp.
 *   • Zoom controls — zoom in/out buttons and scroll-wheel zoom.
 *   • Pan indicator — shows current zoom level.
 *
 * Legend is no longer rendered here — it lives in the right rail to avoid
 * occluding named POI labels on Grand Rift / Lockdown minimaps.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

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

const EVENT_ICON: Record<MarkerEvent["event"], string> = {
  Kill: "🎯",
  Killed: "💀",
  BotKill: "🤖",
  BotKilled: "⚠️",
  Loot: "📦",
  KilledByStorm: "⛈",
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export default function MapView({
  maxSize = 1024,
  minSize = 480,
  ...props
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [zoom, setZoom] = useState(1);

  // Measure container width on mount + resize.
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

  // Reset zoom when map changes.
  useEffect(() => {
    setZoom(1);
  }, [props.mapId]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  // Scroll-wheel zoom handler
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.01;
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
      }
    };
    container.addEventListener("wheel", handler, { passive: false });
    return () => container.removeEventListener("wheel", handler);
  }, []);

  const scaledSize = size ? Math.round(size * zoom) : 0;

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Zoom controls bar */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/80 p-1">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={resetZoom}
            className="flex h-7 items-center justify-center rounded-md px-2 font-mono text-[11px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
            title="Reset zoom to 100%"
          >
            {(zoom * 100).toFixed(0)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom in"
          >
            +
          </button>
        </div>
        {zoom > 1 ? (
          <span className="text-[10px] text-neutral-500">
            Ctrl + scroll to zoom · drag to pan
          </span>
        ) : (
          <span className="text-[10px] text-neutral-500">
            Ctrl + scroll to zoom
          </span>
        )}
      </div>

      {/* Scrollable canvas container */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto rounded-lg border border-neutral-800"
        style={{
          maxHeight: size ? size + 2 : maxSize + 2,
          cursor: zoom > 1 ? "grab" : "default",
        }}
      >
        <div
          style={{
            width: scaledSize || undefined,
            height: scaledSize || undefined,
          }}
        >
          {size ? (
            <MapCanvas
              {...props}
              displaySize={scaledSize}
              onMarkerHover={setHover}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-900 text-sm text-neutral-500">
              Loading canvas…
            </div>
          )}
        </div>
      </div>

      {/* Hover tooltip */}
      {hover && size ? (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-neutral-700/80 bg-neutral-950/95 px-3.5 py-2.5 text-[11px] shadow-xl backdrop-blur-md"
          style={{
            left: clamp((hover.x / zoom) + 14, 8, size - 220),
            top: clamp((hover.y / zoom) + 50, 8, size - 80),
            minWidth: 200,
          }}
        >
          <div className="flex items-center gap-1.5 font-semibold text-neutral-100">
            <span>{EVENT_ICON[hover.event.event]}</span>
            {EVENT_LABEL[hover.event.event]}
          </div>
          <div className="mt-1 text-neutral-400">
            {hover.event.is_human ? (
              <span className="inline-block rounded bg-emerald-900/50 px-1.5 py-0.5 text-[10px] text-emerald-300">
                Human
              </span>
            ) : (
              <span className="inline-block rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                Bot
              </span>
            )}{" "}
            <span className="font-mono">
              {hover.event.user_id.slice(0, 8)}…
            </span>
          </div>
          <div className="mt-1 font-mono text-neutral-500">
            x={hover.event.x.toFixed(1)}, z={hover.event.z.toFixed(1)}
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
