"use client";

/**
 * MapCanvas — Konva stage that renders:
 *   1. Minimap image layer (per-map PNG/JPG from /public/minimaps/)
 *   2. Event markers layer (kills, deaths, loot, storm)
 *
 * Coordinate transform from world (x, z) → pixel (px, py) via lib/coordinates.ts.
 * Canvas is rendered at `displaySize` px; coordinate math is parameterised on it
 * so the layout can shrink on smaller screens without breaking marker positions.
 *
 * Konva touches `window`, so this file is "use client". The main page also wraps
 * its consumer in next/dynamic({ ssr: false }) for safety.
 */

import { useEffect, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Circle, Rect } from "react-konva";

import { MAP_CONFIGS, MapId, worldToPixel } from "@/lib/coordinates";
import type { MarkerEvent } from "@/lib/types";

interface Props {
  mapId: MapId;
  events: MarkerEvent[];
  displaySize?: number;
}

const DEFAULT_SIZE = 800;

/** Marker style by event type. */
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
  displaySize = DEFAULT_SIZE,
}: Props) {
  const map = MAP_CONFIGS[mapId];
  const minimap = useImage(map.minimap);

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

      <Layer>
        {events.map((ev, i) => {
          const { px, py } = worldToPixel(ev.x, ev.z, map, displaySize);
          const s = MARKER_STYLE[ev.event];
          // Bot vs human: bots get a dashed stroke, humans a solid stroke.
          const dash = ev.is_human ? undefined : [3, 2];
          const key = `${ev.match_id}-${ev.user_id}-${i}`;

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
            // Rotated square (diamond): use Rect with offset+rotation.
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
          // 'x' shape — circle with a darker centre to indicate storm.
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
