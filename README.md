# Lila Player Journey

A web-based visualization tool for **LILA BLACK** telemetry — built so a
Level Designer can open the map in their browser and see where players
move, fight, loot, and die across 5 days of production gameplay.

**Live URL:** <https://lila-player-journey-one.vercel.app>
**Repo:** <https://github.com/badhipster/lila-player-journey>

## What it does

Takes 1,243 parquet files (89,104 events across 796 matches and 339 unique
players over Feb 10–14) and renders them onto the correct minimap with:

- Per-event-type markers (Kill / Killed / BotKill / BotKilled / Loot / KilledByStorm)
- Solid stroke = human, dashed stroke = bot
- Per-player path polylines with `user_id` labels at each "head"
- Toggleable heatmaps (Traffic / Kill zones / Death zones)
- Map / date / match cascading filters
- Match-replay timeline scrubber with play/pause, speed controls (0.5×–4×), and event tick marks
- Zoom and pan on the map canvas (Ctrl+scroll or +/− buttons)
- Hover tooltips on every marker (event, player, world coords, timestamp)
- Auto-generated "Current Read" narrative card describing what's on screen

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design rationale
and [`INSIGHTS.md`](./INSIGHTS.md) for three game-design findings I
extracted from the data using the tool.

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) + React 18 + TypeScript |
| Styling | Tailwind CSS |
| Canvas | Konva.js (`react-konva@18`) |
| Heatmap | `simpleheat` |
| Preprocessing | Python 3.9+ with `pandas` + `pyarrow` |
| Hosting | Vercel (auto-deploys on push to `main`) |

## Setup

```bash
git clone https://github.com/badhipster/lila-player-journey
cd lila-player-journey
npm install
npm run dev          # → http://localhost:3000
```

The preprocessed JSON data is committed to the repo under `public/data/`,
so the dev server works immediately — you do **not** need Python or the
parquet files to run the UI.

### Regenerating the JSON from parquet (optional)

If you want to rerun the preprocessing pipeline against the original
parquet files:

```bash
python -m venv .venv && source .venv/bin/activate
pip install pandas pyarrow
python scripts/preprocess.py
```

The script expects `player_data/` to live as a sibling of this project:

```
Lila APM Written Test/
├── player_data/                  ← source parquet files (5 day folders + minimaps/)
└── lila-player-journey/          ← this repo
    ├── scripts/preprocess.py
    └── public/data/              ← regenerated outputs land here
```

Outputs (committed):

| File | Size | Contents |
|---|---|---|
| `public/data/metadata.json` | 200 KB | maps, dates, per-match summaries, totals |
| `public/data/events.json` | 4.0 MB | 16,045 discrete marker events |
| `public/data/positions_sampled.json` | 1.9 MB | 14,612 sampled positions for traffic heatmap |
| `public/data/paths/{match_id}.json` ×796 | 3.5 MB total | per-match polylines per player |

Pipeline runs in ~4.5 s on a MacBook Air.

## Build / deploy

```bash
npm run build        # production build
npm run start        # serve the production build locally
```

Vercel is wired to GitHub `main` — every push triggers a deploy. The
`canvas` Node module is externalised in `next.config.mjs` so Konva's
node entry doesn't break the server build (we never run Konva on the
server; the consumer is wrapped in `next/dynamic({ ssr: false })`).

## Environment variables

None. The data is static, the host is Vercel, and no third-party
services are called from the client.

## Project structure

```
lila-player-journey/
├── public/
│   ├── minimaps/                 ← copied from player_data/minimaps/
│   └── data/                     ← preprocess.py output
│
├── scripts/
│   └── preprocess.py             ← parquet → JSON pipeline
│
├── src/
│   ├── app/
│   │   ├── page.tsx              ← main page, owns filter state
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── MapCanvas.tsx         ← Konva Stage (minimap + heatmap + paths + markers)
│   │   ├── MapView.tsx           ← responsive sizing + hover tooltip wrapper
│   │   ├── FilterPanel.tsx       ← left-rail filters
│   │   ├── Timeline.tsx          ← scrubber with event tick marks
│   │   ├── Legend.tsx            ← right-rail event/heatmap legend
│   │   └── CurrentRead.tsx       ← right-rail narrative card
│   └── lib/
│       ├── coordinates.ts        ← world (x,z) → minimap pixel transform
│       ├── data.ts               ← cached fetchers for /data/*.json
│       ├── types.ts              ← TS types matching JSON schemas
│       └── simpleheat.d.ts       ← ambient module for the JS-only library
│
├── ARCHITECTURE.md               ← one-pager: stack, data flow, tradeoffs
├── INSIGHTS.md                   ← 3 game-design findings + actionable items
└── README.md                     ← this file
```

## Performance notes

- First-load JS: **~95 kB**
- Total `public/data/` weight: **~9.6 MB** (gzipped to ~3 MB by Vercel)
- Heatmap re-renders are gated by `useMemo` on filter inputs — toggling
  modes is instant; resizing the canvas costs ~100 ms with 14K traffic
  points
- Per-match path JSON files are lazy-loaded and cached in a module-level
  `Map`, so re-selecting a match is free

## Credits

- Lila Games for the data and the assignment
- Geist Sans / Mono fonts (via `next/font/local`)
- `simpleheat` for the heatmap kernel
- Konva.js for high-performance canvas rendering
