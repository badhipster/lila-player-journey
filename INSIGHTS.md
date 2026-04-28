# 3 Insights from the Player Journey Tool

These three findings came from spending an hour inside the deployed tool —
toggling heatmap modes, scrubbing matches, comparing maps. All numbers are
derived from the precomputed JSON in `public/data/`, which is itself a
byte-for-byte transformation of the 1,243 parquet files in `player_data/`
(89,104 events total). Reproduce via `python scripts/preprocess.py`.

Insights are ordered by **ship-leverage** (`Reach × Impact × Confidence × Ease`),
not by which is most surprising.

> **A note before reading.** The match-clock unit `t` is compressed in this
> dataset (typical match span is 0.5–1.0 in raw value). I treat it as opaque
> match time throughout, since the relative ordering of events is preserved.
> The findings below depend on event *counts* and *spatial distribution*,
> neither of which is affected by the clock-unit ambiguity.

---

## Insight 1 — The storm is decorative

**What caught my eye.** I expected the "Death zones" heatmap to show a ring
of purple along map edges where the storm catches stragglers. On every map,
on every day, that ring is barely visible — death heat is dominated by
bot-encounter clusters in central POIs.

**Evidence.**

| Stat | Value |
|---|---|
| `KilledByStorm` events | **39** |
| Total marker events | 16,045 |
| Storm-death share of all events | **0.04%** |
| Matches with **zero** storm deaths | **757 / 796 (95.1%)** |
| Storm share of all deaths | 5.3% (vs 94.3% by bots, 0.4% PvP) |

In an extraction shooter, the storm is supposed to be the engine of urgency —
the thing that converts a looting sim into a battle royale. Across 5 days
and 1,243 player files, only 39 players died to it. **Players are
extracting (or dying to bots) before the storm becomes relevant.**

**Actionable.**

- **Change:** Tighten storm schedule — faster shrink, smaller final ring,
  or higher tick damage. A/B test "aggressive storm" cohort vs. control.
- **Metrics that move:**
  - `avg match duration` ↓
  - `storm-death share of all deaths` ↑ from 5% to a designed target (e.g. 25%)
  - `final-circle PvP encounter rate` ↑ (storm is supposed to *cause* the
    encounters that Insight #2 shows are missing)

**Why a Level Designer should care.** The storm is the funnel that creates
emergent late-game encounters. Today, 95% of matches end before that funnel
matters, so every map's *extraction layout* is being judged on solo
navigation, not on storm-pressured decision-making. Concrete LD lever:
ensure ≥75% of extraction points sit inside the second-to-final circle so
players are forced into storm risk.

---

## Insight 2 — This dataset is a solo-PvE experience masquerading as a multiplayer extraction shooter

**What caught my eye.** Picking the highest-kill matches from the dropdown
and selecting "Replay match", I expected to see paths from multiple humans
crossing each other. Almost every match shows a single neon-green path
tracing solo through the map.

**Evidence.**

| Stat | Value |
|---|---|
| Solo-human matches (1 human) | **779 / 796 (97.9%)** |
| Multi-human matches (≥2 humans) | **1 / 796** |
| `Kill` (PvP) + `Killed` (PvP) events | **6 / 89,104** total events |
| PvP share of all combat | **0.19%** |
| Bot-vs-human combat events | 3,115 (`BotKill` + `BotKilled`) |
| Of all 742 deaths: by bot / by storm / by human | 94.3% / 5.3% / **0.4%** |

In other words: there are **6 human-vs-human kill events** across **5 days
of production gameplay**. The "extraction shooter" framing of LILA BLACK
isn't borne out by the data — what shipped to these players was effectively
a single-player PvE looter with bot opposition.

**Actionable.**

- **Change (matchmaking-side):** Diagnose whether this is a soft-launch
  effect (small player base, lobbies fill with bots) or a deliberate
  early-funnel design (solo onboarding → PvP later). If soft-launch:
  lower lobby-fill thresholds, widen MMR matchmaking windows, or skill-
  bracket queues so humans actually meet humans.
- **Change (LD-side, even if matchmaking is right):** invest hard in bot AI
  variety — *bots ARE the encounter* in this data (94% of deaths). Today's
  bot encounter quality is the player's primary combat experience.
- **Metrics that move:**
  - `avg humans per match` ↑ from 0.98 toward designed lobby size
  - `PvP encounter rate` ↑
  - `D7 / D30 retention` (PvE-only loops historically retain worse than
    competitive-encounter loops)

**Why a Level Designer should care.** Every chokepoint, sight line, and
ambush spot you've designed is currently being validated against
*solo-vs-bot navigation*, not against human encounter design. The data is
silently reinforcing the wrong layout assumptions. Until fill-rate is
fixed, design with **bot-encounter cadence** as the primary signal —
because that's what 99.6% of players actually experience.

---

## Insight 3 — Grand Rift is the most action-dense map but the least played

**What caught my eye.** Cycling through maps in the tool, Grand Rift's
minimap shows the most labelled POIs ("Maintenance Bay", "Burnt Zone",
"Engineer's Quarters", "Gas Station", "Cave House") and the visible
heatmap clusters tightly around the central pit. But its match count is
by far the lowest.

**Evidence.**

| Map | Matches | % of total | Avg kills / match | Avg bots / match |
|---|---|---|---|---|
| **Ambrose Valley** | 566 | 71.1% | 3.18 | 0.50 |
| **Lockdown** | 171 | 21.5% | 2.49 | 0.73 |
| **Grand Rift** | **59** | **7.4%** | **3.27 (highest)** | **0.92 (highest)** |

Grand Rift produces *more* combat per match than either alternative — yet
gets ~10× less play than Ambrose. The most action-dense map is also the
one players are least exposed to.

**Actionable.**

- **Change:** First, diagnose the demand gap. Three plausible causes:
  1. Matchmaker default (rotation favours Ambrose)
  2. UI bias (map order, default selection in the launcher)
  3. Player perception of difficulty (Grand Rift's denser POIs may *look*
     intimidating in lobby previews)
- **Experiment:** A/B feature-rotate Grand Rift as the default for a
  cohort. If discovery is the issue, guarantee Grand Rift appearance in
  the first 3 onboarding matches.
- **Metrics that move:**
  - `Grand Rift match share` ↑ from 7.4% toward portfolio-balance target
  - `overall avg kills per match` ↑ (Grand Rift has the highest density)
  - early-game engagement / D1 retention if action-density correlates

**Why a Level Designer should care.** When 90% of player-time is on a
single map, your map design portfolio is effectively *one map*. Whatever
is working in Grand Rift's layout — denser POIs, higher per-match combat
density — is hidden insight that should inform Ambrose 2.0 or your next
map. Conversely, if players are *avoiding* Grand Rift for layout reasons
(visibility, traversal friction, lobby preview readability), LDs need to
know which level-design features cause avoidance, both to fix Grand Rift
and to *not repeat the mistake* in the next map.

---

## How to reproduce these numbers

```bash
git clone https://github.com/badhipster/lila-player-journey
cd lila-player-journey

# Inspect the precomputed JSON directly
cat public/data/metadata.json | jq '.totals'
cat public/data/events.json | jq '[.[] | .event] | group_by(.) | map({(.[0]):length}) | add'

# Or regenerate from the parquet files
python -m venv .venv && source .venv/bin/activate
pip install pandas pyarrow
python scripts/preprocess.py
```

The exact ranking of maps, the 6-vs-3,115 PvP-vs-bot ratio, and the
39-vs-89,104 storm-event count are all printed by the preprocessing
script's distribution summary.

---

## Insights I deliberately did not surface

- **"AmbroseValley northeast is a dead zone"** — I expected this from the
  framework's worked example, but the Traffic heatmap actually distributes
  reasonably across Ambrose's quadrants. Calling it a dead zone would be
  inventing a finding the data didn't support.
- **"Loot vs combat zone mismatch"** — Loot is 80% of all marker events,
  so it co-occurs with everything. The signal-to-noise was too low to
  draw a confident actionable from this dataset.
- **"Match-clock anomaly"** — interesting from a data-engineering lens
  (match spans look compressed) but it's about the dataset, not about the
  game. Documented as an assumption in `ARCHITECTURE.md` instead.
