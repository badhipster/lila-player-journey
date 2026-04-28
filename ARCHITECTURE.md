# Player Journey Visualization Tool — Architecture

**Live URL:** <https://lila-player-journey-one.vercel.app>
**Repo:** <https://github.com/badhipster/lila-player-journey>

## What I built it with and why

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Next.js 14 (App Router) + TypeScript + Tailwind** | One-click Vercel deploys, file-based routing, excellent DX. Static-export friendly since the data is fixed. |
| Canvas rendering | **Konva.js** via `react-konva@18` | Native canvas performance for thousands of marker shapes; the `Layer` model maps cleanly to "minimap → heatmap → paths → markers". Avoided D3 (overkill for fixed-shape rendering) and Mapbox (its coordinate system would fight ours). |
| Heatmap | **`simpleheat`** drawn to an offscreen canvas, then mounted as a `Konva.Image` | ~3 KB, kernel-density done. Composited with `globalCompositeOperation="screen"` so heat colors brighten the dark minimap rather than masking it. |
| Data preprocessing | **Python 3.9 + pandas + pyarrow** | README quick-start was Python; pyarrow reads parquet files regardless of file extension; pandas makes the timestamp normalization and group-bys trivial. One-time job, ~4.5s on the full dataset. |
| Data delivery | **Static JSON files** in `public/data/`, gzip-compressed by Vercel automatically | Dataset is fixed (5 days, 1,243 files). Static = fastest cold start, simplest deploy, no API surface to secure. Lazy-fetched per-match path JSONs keep the initial payload small. |
| Hosting / CI/CD | **Vercel**, linked to GitHub `main` | Every `git push` auto-deploys. Free tier is enough for the file size we ship. |

## How data flows from parquet to screen

```
1,243 parquet files (../player_data/February_*/{user_id}_{match_id}.nakama-0)
        │   89,104 rows total
        │
        │  scripts/preprocess.py     (one-time, local)
        │    1. Walk each February_NN/ folder
        │    2. Read parquet via pyarrow (no .parquet extension required)
        │    3. Decode `event` column from bytes → utf-8
        │    4. Split filename on first underscore → user_id, match_id
        │    5. Classify human (UUID user_id) vs. bot (numeric user_id)
        │    6. Normalize ts within each match: t = (ts - ts.min()).seconds
        │    7. Split into discrete-marker events vs. position events
        │    8. Sub-sample positions (every 3rd point) for path rendering
        │    9. Sub-sample positions (every 5th row) for traffic heatmap
        ▼
public/data/
  ├── metadata.json              (200 KB — maps, dates, per-match summaries, totals)
  ├── events.json                (4.0 MB — 16,045 discrete marker events)
  ├── positions_sampled.json     (1.9 MB — 14,612 sampled positions for heatmap)
  └── paths/{match_id}.json ×796 (3.5 MB total — one file per match,
                                  sub-sampled position polylines per player)
        │
        │  Next.js static fetch on demand
        │    metadata + events:    on first paint
        │    positions_sampled:    when Traffic heatmap first activates
        │    paths/{match_id}:     when a specific match is selected
        ▼
React state (hooks in src/app/page.tsx)
  filters → mapId, dateFilter, matchFilter, enabledEventTypes,
            heatmapMode, tCutoff
        │
        │  useMemo derivations
        │    filteredEvents       (markers, all filters applied)
        │    heatmapConfig        (per-mode point source, filtered)
        │    timelineMarks        (events in selected match → tick kinds)
        ▼
Konva Stage (responsive, square, capped at 1024px)
  ├── Layer 1: minimap image (per-map PNG/JPG, half-opacity when heatmap on)
  ├── Layer 2: heatmap        (simpleheat → offscreen canvas → Konva.Image)
  ├── Layer 3: paths          (Konva.Line per player, color hashed from user_id)
  │           + Konva.Text labels at each path's "head" position
  └── Layer 4: markers        (Circle / Rect / diamond per event type;
                               solid stroke = human, dashed stroke = bot;
                               onMouseEnter raises hover tooltip in MapView)
```

## How I mapped game coordinates to the minimap

Per the README:

```
u       = (x - origin_x) / scale
v       = (z - origin_z) / scale
pixel_x = u * displaySize
pixel_y = (1 - v) * displaySize          ← Y axis flipped (image origin top-left)
```

Implemented in `src/lib/coordinates.ts` (`worldToPixel`, with reverse and
bulk variants). Critical decisions:

1. **Use `x` and `z`, not `x` and `y`.** The data has 3D coordinates;
   `y` is elevation. Plotting on a 2D top-down minimap requires (x, z).
   This is the single biggest footgun in the dataset, called out in the
   README and verified during data sanity-check (Hour 0–1).

2. **Per-map config table** hardcoded — not derived from data ranges
   (which are noisy near map edges):

   | Map | Scale | Origin X | Origin Z | Minimap |
   |---|---|---|---|---|
   | Ambrose Valley | 900 | -370 | -473 | `.png` |
   | Grand Rift | 581 | -290 | -290 | `.png` |
   | Lockdown | 1000 | -500 | -500 | `.jpg` (note: not PNG) |

3. **Y-axis flip** because image origin is top-left and world Z follows
   standard math convention. Forgetting `(1 - v)` mirrors the entire map
   vertically — every kill ends up on the wrong side of the storm wall.

4. **Validated against the README example point** (`(-301.45, -355.55)` →
   `(78, 890)` on Ambrose) before any UI work. Sanity check ran in the
   first hour against the full dataset: x-range and z-range per map were
   inside `[origin, origin + scale]` for all 3 maps.

5. **`displaySize` is parameterised**, not fixed at 1024. The Konva
   Stage sizes itself via a `ResizeObserver` on the wrapper div, so the
   canvas fills the middle column on a wide monitor (up to 1024px) and
   degrades gracefully on narrow ones (down to a 480px floor). All
   coordinate math passes the live `displaySize`, so markers stay
   pixel-correct at any size.

## Assumptions I made

| Assumption | Reason | Impact if wrong |
|---|---|---|
| UUID `user_id` = human, numeric `user_id` = bot | README explicit; cross-validated by `Position` vs `BotPosition` event presence per file | Visual distinction would invert; would be obvious in QA |
| Filenames contain exactly one separating `_` between user_id and match_id | README example confirmed; `split("_", 1)` handles both UUID-UUID (humans) and numeric-UUID (bots) | Mis-parsed match_ids → broken match-grouping |
| `event` column is bytes and must be `.decode('utf-8')` | Confirmed in README and at Hour-0 sanity probe | Without decoding, every string equality returns False — silent empty event categories |
| `ts` represents match-internal time but the unit is compressed | Per-match span is consistently 0.5–1.0 in raw value across 285 inspected matches; exceeds physically plausible match length if interpreted as ms | Within-match relative ordering still correct, so timeline scrubbing works regardless of unit interpretation. Documented honestly in INSIGHTS.md and the Timeline UI label |
| Default day is Feb 13 (last full day) | Feb 14 is partial per README | First-load data slightly less rich, but not wrong |
| Position events can be sub-sampled at 1/3 for paths and 1/5 for heatmap | ~73K position events; 1/3 keeps path smoothness, 1/5 keeps heatmap density without 5MB JSON | Path lines get ~3× less smooth; spatial distribution is preserved |
| Files have no `.parquet` extension | Verified via `os.listdir` — they all end in `.nakama-0` | A naive `glob('*.parquet')` finds zero files; `pyarrow.parquet.read_table(path)` reads them anyway |
| Map config is per-map and never changes | Hardcoded in `coordinates.ts` and `metadata.json` | Adding a new map requires a code change; acceptable for a fixed-content tool |
| Bots-only matches exist (16 / 796 have 0 humans) | Visible in metadata distribution | Filter logic handles `humans=0` without crashing |

## Major tradeoffs

| Decision | Considered | Chose | Why |
|---|---|---|---|
| Browser parquet (DuckDB-WASM) vs preprocessed JSON | DuckDB-WASM gives ad-hoc SQL on dynamic datasets in-browser | **Preprocessed JSON** | Our dataset is 5 days of static data that never changes between deploys. We'd pay an 8 MB WASM tax for query flexibility we'd never use. Preprocessing also fixes the schema at build time, removes in-browser bytes-decode, and lets us serve cacheable per-match path JSONs |
| Streamlit vs Next.js | Streamlit ships widget-and-plot dashboards in hours | **Next.js + Konva** | Our core artifact is a custom canvas with 4 z-ordered layers (minimap → heatmap → paths → markers), per-shape hover tooltips, and a timeline-synced cutoff. That's a custom interactive component, not a Streamlit chart. Embedding it via `st.components.v1.html` would defeat Streamlit's purpose. Next.js gives us full control with the same deploy story (one-click Vercel) |
| Auto-loop animation vs scrubber + Play | Auto-loop is "playback" in the literal sense | **Scrubber + Play + event tick marks** | Auto-loop is a strict subset of scrubber-with-play — designers can still hit Play for linear viewing, but they can also drag to "the kill at t=0.42" without waiting. Tick marks on the scrubber expose where each event fires, which auto-loop can't do |
| Single-color paths vs per-player color | Single color = less to look at | **Hashed HSL per `user_id`** | Single color makes multi-player paths indistinguishable. We hash `user_id` deterministically to an HSL hue (humans = vivid; bots = desaturated dashed). For this dataset's 97.9%-solo matches the visual upside is small, but the code cost is one helper and it future-proofs for real lobby fill |
| Single combat heatmap vs three modes | One mode = simpler | **Traffic / Kills / Deaths** | Three orthogonal Level-Designer questions: "where do players spend time?", "where do humans win fights?", "where do players lose fights?". A single combat heatmap can't distinguish the corner where you ambush bots from the corner where the storm catches you. Cost is ~15 lines of conditional gradient config; modes share all the simpleheat plumbing |
| Mobile-first responsive vs desktop-first | Mobile-first is the modern default | **Desktop-first 3-column grid, single-column collapse below `lg`** | Level Designers work on 27"+ monitors with game tools docked alongside; designing for mobile-first optimises for a viewport the user never has at the cost of the one they always do. Mobile still functions (single column below `lg`); we explicitly did NOT polish mobile sidebar collapse — noted as a cut-list item |
| Legend as canvas overlay vs right-rail card | Overlay is always visible | **Right-rail card** (after launch bug) | The overlay variant occluded named POI labels on Grand Rift ("BURNT ZONE", "ENGINEER'S QUARTERS") and Lockdown — the legend was painting over the data. Right-rail version is always visible too, without competing with the map |
| Heatmap inside Konva vs DOM-stacked canvas | DOM stacking is simpler to wire up | **Inside Konva (Image layer)** | Single Stage means one z-order, one resize handler, one mount/unmount path. Composability for future layers (extraction zones, safe-zone history) stays trivial; DOM stacking would force every new layer to re-solve coordinate sync |

## What I would do next given more time

1. **Compare-mode** — same map, two date ranges side by side (before/after a patch view).
2. **"Recommended replays"** — heuristic-pick top-3 most informative matches (highest combat density, longest path, most bots) and surface them as one-click presets, instead of the raw 78-option dropdown.
3. **Bot path predictability score** per zone — a numeric "exploitability" metric per map area.
4. **Click-to-drill on the map** — click a hot spot, get the list of matches that contributed events there.
5. **GIF export** of the active match replay for posting in Slack / design reviews.
6. **Pin-and-share insight workflow** — annotate a map region with a note, copy a permalink, drop in Notion.

## Local dev

```bash
git clone https://github.com/badhipster/lila-player-journey
cd lila-player-journey
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
```

Regenerating preprocessed JSON (only needed if you re-run from the
original parquet files; outputs are committed to the repo):

```bash
python -m venv .venv && source .venv/bin/activate
pip install pandas pyarrow
python scripts/preprocess.py
```

The script expects the source `player_data/` folder to live at
`../player_data/` relative to the project root (i.e. as a sibling
directory). Adjust `DATA_DIR` in the script otherwise.

## Hosted URL

**<https://lila-player-journey-one.vercel.app>**
