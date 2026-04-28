"use client";

/**
 * MapView — wraps MapCanvas with next/dynamic({ ssr: false }) so Konva (which
 * touches `window`) only loads on the client.
 */

import dynamic from "next/dynamic";
import type { MapId } from "@/lib/coordinates";
import type { MarkerEvent, MatchPaths } from "@/lib/types";
import type { HeatmapConfig } from "./MapCanvas";

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
  displaySize?: number;
}

export default function MapView(props: Props) {
  return <MapCanvas {...props} />;
}
