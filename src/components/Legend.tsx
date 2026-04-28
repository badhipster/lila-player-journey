"use client";

/**
 * Legend — small overlay anchored top-right of the canvas. Documents marker
 * color/shape and the bot vs human stroke convention. Also surfaces the
 * current heatmap mode label if one is active.
 */

import type { HeatmapMode } from "./FilterPanel";

interface Props {
  heatmapMode: HeatmapMode;
}

const ITEMS: {
  label: string;
  fill: string;
  stroke: string;
  shape: "circle" | "diamond" | "square";
}[] = [
  { label: "Kill (PvP)",      fill: "#ef4444", stroke: "#7f1d1d", shape: "circle" },
  { label: "Killed (PvP)",    fill: "#0a0a0a", stroke: "#7f1d1d", shape: "circle" },
  { label: "Bot kill",        fill: "#f97316", stroke: "#7c2d12", shape: "diamond" },
  { label: "Killed by bot",   fill: "#7f1d1d", stroke: "#1c0a0a", shape: "diamond" },
  { label: "Loot",            fill: "#facc15", stroke: "#854d0e", shape: "square" },
  { label: "Storm death",     fill: "#a855f7", stroke: "#581c87", shape: "circle" },
];

export default function Legend({ heatmapMode }: Props) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 w-[200px] rounded-lg border border-neutral-800 bg-neutral-950/85 p-3 text-[11px] backdrop-blur-sm">
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
        Legend
      </div>
      <ul className="space-y-1.5">
        {ITEMS.map((it) => (
          <li key={it.label} className="flex items-center gap-2">
            <Swatch shape={it.shape} fill={it.fill} stroke={it.stroke} />
            <span className="text-neutral-200">{it.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t border-neutral-800 pt-2 text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-3 border border-neutral-200" />
          solid border = human
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-2.5 w-3 border border-dashed border-neutral-200" />
          dashed border = bot
        </div>
      </div>
      {heatmapMode !== "off" ? (
        <div className="mt-2 border-t border-neutral-800 pt-2 text-neutral-400">
          Heatmap:{" "}
          <span className="text-neutral-200">
            {heatmapMode === "traffic"
              ? "Traffic (player flow)"
              : heatmapMode === "kills"
                ? "Kill zones"
                : "Death zones"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Swatch({
  shape,
  fill,
  stroke,
}: {
  shape: "circle" | "diamond" | "square";
  fill: string;
  stroke: string;
}) {
  const common =
    "inline-block h-3 w-3 shrink-0 border";
  if (shape === "circle")
    return (
      <span
        className={`${common} rounded-full`}
        style={{ background: fill, borderColor: stroke }}
      />
    );
  if (shape === "diamond")
    return (
      <span
        className={`${common} rotate-45`}
        style={{ background: fill, borderColor: stroke }}
      />
    );
  return (
    <span
      className={common}
      style={{ background: fill, borderColor: stroke }}
    />
  );
}
