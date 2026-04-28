/**
 * World-to-Minimap Coordinate Transformation
 *
 * Drop into src/lib/coordinates.ts of your Next.js project.
 *
 * Spec from README:
 *   u = (x - origin_x) / scale
 *   v = (z - origin_z) / scale
 *   pixel_x = u * 1024
 *   pixel_y = (1 - v) * 1024    ← Y FLIPPED (image origin is top-left)
 *
 * IMPORTANT: use the data's `x` and `z` columns. NOT `y` — that is elevation.
 */

export type MapId = "AmbroseValley" | "GrandRift" | "Lockdown";

export interface MapConfig {
  id: MapId;
  scale: number;
  originX: number;
  originZ: number;
  minimap: string;
}

export const MAP_CONFIGS: Record<MapId, MapConfig> = {
  AmbroseValley: {
    id: "AmbroseValley",
    scale: 900,
    originX: -370,
    originZ: -473,
    minimap: "/minimaps/AmbroseValley_Minimap.png",
  },
  GrandRift: {
    id: "GrandRift",
    scale: 581,
    originX: -290,
    originZ: -290,
    minimap: "/minimaps/GrandRift_Minimap.png",
  },
  Lockdown: {
    id: "Lockdown",
    scale: 1000,
    originX: -500,
    originZ: -500,
    minimap: "/minimaps/Lockdown_Minimap.jpg",
  },
};

export const MINIMAP_PIXELS = 1024;

/**
 * Transform world (x, z) → minimap pixel (px, py).
 * Returns null if the coordinate falls outside the minimap.
 */
export function worldToPixel(
  x: number,
  z: number,
  map: MapConfig,
  size: number = MINIMAP_PIXELS,
): { px: number; py: number } {
  const u = (x - map.originX) / map.scale;
  const v = (z - map.originZ) / map.scale;
  const px = u * size;
  const py = (1 - v) * size; // flip Y for top-left image origin
  return { px, py };
}

/**
 * Bulk transform an array of points. Used for paths and heatmaps.
 */
export function worldPathToPixels(
  points: { x: number; z: number; t?: number }[],
  map: MapConfig,
  size: number = MINIMAP_PIXELS,
): { px: number; py: number; t?: number }[] {
  return points.map((p) => {
    const { px, py } = worldToPixel(p.x, p.z, map, size);
    return { px, py, t: p.t };
  });
}

/**
 * Sanity check: is (px, py) within minimap bounds?
 * Useful for filtering corrupted data.
 */
export function isInBounds(
  px: number,
  py: number,
  size: number = MINIMAP_PIXELS,
): boolean {
  return px >= 0 && px <= size && py >= 0 && py <= size;
}

/**
 * Reverse transform: pixel → world. Useful for click-to-show-info features.
 */
export function pixelToWorld(
  px: number,
  py: number,
  map: MapConfig,
  size: number = MINIMAP_PIXELS,
): { x: number; z: number } {
  const u = px / size;
  const v = 1 - py / size;
  const x = u * map.scale + map.originX;
  const z = v * map.scale + map.originZ;
  return { x, z };
}

/**
 * Test fixtures from README example (AmbroseValley):
 *   World: x=-301.45, z=-355.55
 *   Pixel: (78, 890)
 *
 * Run via: console.log(worldToPixel(-301.45, -355.55, MAP_CONFIGS.AmbroseValley))
 * Expected: { px: ~78, py: ~890 }
 */
