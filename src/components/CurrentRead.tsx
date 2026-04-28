"use client";

/**
 * CurrentRead — a small narrative card in the right rail that summarises what
 * the user is currently looking at, derived entirely from real filter +
 * counts state. Inspired by the prototype's "Current Read" pattern but data-
 * driven instead of hardcoded.
 */

import type { HeatmapMode } from "./FilterPanel";
import type { MapId } from "@/lib/coordinates";
import type { MatchSummary } from "@/lib/types";

interface Props {
  mapId: MapId;
  dateFilter: string;
  matchFilter: string;
  heatmapMode: HeatmapMode;
  selectedMatch: MatchSummary | null;
  totalMarkers: number;
  humans: number;
  bots: number;
  matchesOnMap: number;
}

const MAP_LABEL: Record<MapId, string> = {
  AmbroseValley: "Ambrose Valley",
  GrandRift: "Grand Rift",
  Lockdown: "Lockdown",
};

const DATE_LABEL: Record<string, string> = {
  February_10: "Feb 10",
  February_11: "Feb 11",
  February_12: "Feb 12",
  February_13: "Feb 13",
  February_14: "Feb 14 (partial day)",
};

export default function CurrentRead(props: Props) {
  const {
    mapId,
    dateFilter,
    matchFilter,
    heatmapMode,
    selectedMatch,
    totalMarkers,
    humans,
    bots,
    matchesOnMap,
  } = props;

  const map = MAP_LABEL[mapId];
  const dateText =
    dateFilter === "all" ? "all 5 days" : (DATE_LABEL[dateFilter] ?? dateFilter);

  // Match-replay narrative.
  if (matchFilter !== "all" && selectedMatch) {
    return (
      <Card title="Current read">
        <p>
          <strong className="text-neutral-100">Replaying match</strong>{" "}
          <span className="font-mono">
            {selectedMatch.match_id.slice(0, 8)}
          </span>{" "}
          on <strong className="text-neutral-100">{map}</strong> ({dateText}):{" "}
          {selectedMatch.humans} human(s), {selectedMatch.bots} bot file(s),{" "}
          <strong className="text-neutral-100">{selectedMatch.kills}</strong>{" "}
          combat events
          {selectedMatch.storm_deaths > 0
            ? `, ${selectedMatch.storm_deaths} storm death(s)`
            : ""}
          .
        </p>
        <p className="mt-2 text-neutral-500">
          Scrub the timeline to watch paths grow and markers appear in
          chronological order. Tick marks on the slider show when each event
          fired.
        </p>
      </Card>
    );
  }

  // Aggregate / empty narrative.
  const lead =
    totalMarkers === 0
      ? "No markers visible — try widening the date filter or enabling more event types."
      : `${totalMarkers.toLocaleString()} markers across ${matchesOnMap} match${
          matchesOnMap === 1 ? "" : "es"
        } on ${map}, ${dateText}.`;

  let heatmapNote: string | null = null;
  if (heatmapMode === "traffic") {
    heatmapNote =
      "Traffic heatmap: bright clusters mark choke points and POIs where players spend time. Cool edges are quiet zones — candidates for cover, loot, or shrinking.";
  } else if (heatmapMode === "kills") {
    heatmapNote =
      "Kill-zone heatmap: clusters indicate ambush corners and sight lines that consistently end fights in the human's favour.";
  } else if (heatmapMode === "deaths") {
    heatmapNote =
      "Death-zone heatmap: dense red is bot encounters; sparse purple is storm deaths. Sparseness here is itself the finding — storm pressure rarely closes the loop.";
  }

  const split =
    totalMarkers > 0
      ? `${humans.toLocaleString()} from humans · ${bots.toLocaleString()} from bots.`
      : null;

  return (
    <Card title="Current read">
      <p>{lead}</p>
      {heatmapNote ? <p className="mt-2 text-neutral-300">{heatmapNote}</p> : null}
      {split ? <p className="mt-2 text-neutral-500">{split}</p> : null}
    </Card>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-[12px] leading-relaxed text-neutral-300">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
        {title}
      </div>
      {children}
    </div>
  );
}
