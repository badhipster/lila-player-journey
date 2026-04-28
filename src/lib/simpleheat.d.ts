/**
 * Minimal type stub for `simpleheat`. The package ships no .d.ts.
 * We only use a small subset of its imperative API.
 */
declare module "simpleheat" {
  export interface Heatmap {
    data(points: [number, number, number][]): Heatmap;
    add(point: [number, number, number]): Heatmap;
    clear(): Heatmap;
    radius(r: number, blur?: number): Heatmap;
    gradient(stops: Record<number, string>): Heatmap;
    resize(): Heatmap;
    draw(minOpacity?: number): Heatmap;
  }
  function simpleheat(canvas: HTMLCanvasElement): Heatmap;
  export default simpleheat;
}
