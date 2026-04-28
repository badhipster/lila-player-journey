"use client";

/**
 * MapCanvas — Konva stage that renders, in order:
 *   1. Minimap image layer (per-map PNG/JPG from /public/minimaps/)
 *   2. Player path layer (polyline per player from MatchPaths, optional)
 *   3. Event markers layer (kills, deaths, loot, storm)
 *
 * Coordinate transform from world (x, z) → pixel (px, py) via lib/coordinates.ts.
 * Konva touches `window`, so this file is "use client". The main page also wraps
 * the consumer in next/dynamic({ ssr: false }).
 */

import { useEffect, useMemo, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Circle, Rect, Line } from "react-konva";

import { MAP_CONFIGS, MapId, worldToPixel } from "@/lib/coordinates";
import type { MarkerEvent, MatchPaths } from "@/lib/types";

interface Props {
  mapId: MapId;
  events: MarkerEvent[];
  paths?: MatchPaths | null;
  /** When set, only path points and events with t <= tCutoff are rendered. */
  tCutoff?: number | null;
  displaySize?: number;
}

const DEFAULT_SIZE = 800;

const MARKER_STYLE: Record<
  MarkerEvent["event"],
  { fill: string; stroke: string; radius: number; shape: "circle" | "diamond" | "x" | "square" }
> = {
  Kill:           { fill: "#ef4444", stroke: "#7f1d1d", radius: 5, shape: "circle" },
  Killed:         { fill: "#0a0a0a", stroke: "#7f1d1d", radius: 5, shape: "circle" },
  BotKill:        { fill: "#f97316", stroke: "#7c2d12", radius: 5, shape: "diamond" },
  BotKilled:      { fill: "#7f1d1d", stroke: "#1c0a0a", radius: 5, shape: "diamond" },
  Loot:           { fill: "#facc15", stroke: "#854d0e", radius: 4, shape: "square" },
  KilledByStorm:  { fill: "#a855f7", stroke: "#581c87", radius: 5, shape: "x" },
};

/** Cheap, deterministic string→hue. Bots get a desaturated/dimmer palette. */
function userHue(uid: string): number {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return h % 360;
}

function useImage(src: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setImg(null);
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.src = src;
    i.onload = () => setImg(i);
  }, [src]);
  return img;
}

export default function MapCanvas({
  mapId,
  events,
  paths = null,
  tCutoff = null,
  displaySize = DEFAULT_SIZE,
}: Props) {
  const map = MAP_CONFIGS[mapId];
  const minimap = useImage(map.minimap);

  // Apply tCutoff to events.
  const visibleEvents = useMemo(
    () =>
      tCutoff == null ? events : events.filter((e) => e.t <= (tCutoff as number)),
    [events, tCutoff],
  );

  // Pre-compute path polyline points (flattened [x1,y1,x2,y2,...]) per player.
  const pathPolylines = useMemo(() => {
    if (!paths) return [];
    return paths.players
      .map((p) => {
        const pts = tCutoff == null ? p.points : p.points.filter((pt) => pt.t <= tCutoff);
        if (pts.length < 2) return null;
        const flat: number[] = [];
        for (const pt of pts) {
          const { px, py } = worldToPixel(pt.x, pt.z, map, displaySize);
          flat.push(px, py);
        }
        const hue = userHue(p.user_id);
        const color = p.is_human
          ? `hsl(${hue}, 90%, 65%)`
          : `hsl(${hue}, 25%, 45%)`;
        return {
          key: p.user_id,
          flat,
          color,
          isHuman: p.is_human,
          // Last point — useful as a "current position" dot.
          last: flat.length >= 2
            ? { x: flat[flat.length - 2], y: flat[flat.length - 1] }
            : null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [paths, tCutoff, map, displaySize]);

  return (
    <Stage
      width={displaySize}
      height={displaySize}
      style={{ background: "#0a0a0a", borderRadius: 8 }}
    >
      <Layer listening={false}>
        {minimap ? (
          <KonvaImage
            image={minimap}
            width={displaySize}
            height={displaySize}
            opacity={0.85}
          />
        ) : (
          <Rect width={displaySize} height={displaySize} fill="#111" />
        )}
      </Layer>

      {/* Paths */}
      {pathPolylines.length > 0 ? (
        <Layer listening={false}>
          {pathPolylines.map((p) => (
            <Line
              key={p.key}
              points={p.flat}
              stroke={p.color}
              strokeWidth={p.isHuman ? 1.5 : 1}
              opacity={p.isHuman ? 0.85 : 0.5}
              lineCap="round"
              lineJoin="round"
              dash={p.isHuman ? undefined : [3, 3]}
            />
          ))}
          {/* "current head" markers — last position of each player */}
          {pathPolylines
            .filter((p) => p.last)
            .map((p) => (
              <Circle
                key={`${p.key}-head`}
                x={p.last!.x}
                y={p.last!.y}
                radius={p.isHuman ? 3.5 : 2.5}
                fill={p.color}
                stroke="#0a0a0a"
                strokeWidth={1}
              />
            ))}
        </Layer>
      ) : null}

      {/* Markers */}
      <Layer>
        {visibleEvents.map((ev, i) => {
          const { px, py } = worldToPixel(ev.x, ev.z, map, displaySize);
          const s = MARKER_STYLE[ev.event];
          const dash = ev.is_human ? undefined : [3, 2];
          const key = `${ev.match_id}-${ev.user_id}-${ev.event}-${i}`;

          if (s.shape === "circle") {
            return (
              <Circle
                key={key}
                x={px}
                y={py}
                radius={s.radius}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth={1.5}
                dash={dash}
              />
            );
          }
          if (s.shape === "square") {
            return (
              <Rect
                key={key}
                x={px - s.radius}
                y={py - s.radius}
                width={s.radius * 2}
                height={s.radius * 2}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth={1.2}
                dash={dash}
              />
            );
          }
          if (s.shape === "diamond") {
            return (
              <Rect
                key={key}
                x={px}
                y={py}
                width={s.radius * 2}
                height={s.radius * 2}
                offsetX={s.radius}
                offsetY={s.radius}
                rotation={45}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth={1.2}
                dash={dash}
              />
            );
          }
          // 'x' (storm) — circle with darker outline
          return (
            <Circle
              key={key}
              x={px}
              y={py}
              radius={s.radius}
              fill={s.fill}
              stroke="#0a0a0a"
              strokeWidth={2}
              dash={dash}
            />
          );
        })}
      </Layer>
    </Stage>
  );
}
