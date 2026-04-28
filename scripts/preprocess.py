"""
Lila Player Journey - Preprocessing Pipeline

Reads all parquet files from player_data/, normalizes them, and writes:
- public/data/metadata.json    (maps, dates, match summaries)
- public/data/events.json      (all non-Position events)
- public/data/paths/{match_id}.json  (Position paths per match, sub-sampled)

Run from project root:
    python scripts/preprocess.py

Paths are resolved relative to this script, so it works from any CWD.
"""

from __future__ import annotations  # PEP 563 — supports `X | None` on Python 3.9

import json
import os
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

# Resolve relative to this script so the pipeline works from any CWD.
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT.parent / "player_data"  # ../player_data relative to project root
OUTPUT_DIR = PROJECT_ROOT / "public" / "data"
PATHS_DIR = OUTPUT_DIR / "paths"

DAYS = ["February_10", "February_11", "February_12", "February_13", "February_14"]

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

# Sub-sample Position events to every Nth point for path rendering
POSITION_SUBSAMPLE = 3

# Event types we treat as discrete markers (not paths)
MARKER_EVENTS = {"Kill", "Killed", "BotKill", "BotKilled", "KilledByStorm", "Loot"}
POSITION_EVENTS = {"Position", "BotPosition"}

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def parse_filename(filename: str) -> tuple[str, str, bool]:
    """
    Parse {user_id}_{match_id}.nakama-0 into (user_id, match_id, is_human).
    Splits on FIRST underscore only because match_id contains hyphens.
    """
    base = filename.replace(".nakama-0", "")
    parts = base.split("_", 1)
    if len(parts) != 2:
        return None, None, False
    user_id, match_id = parts
    is_human = bool(UUID_RE.match(user_id))
    return user_id, match_id, is_human


def decode_event(val):
    """Event column is bytes in parquet. Decode to UTF-8 string."""
    if isinstance(val, bytes):
        return val.decode("utf-8")
    return val


def load_file(filepath: Path) -> pd.DataFrame | None:
    """Load one parquet file, decode events, attach metadata. Returns None on failure."""
    try:
        table = pq.read_table(filepath)
        df = table.to_pandas()
    except Exception as e:
        print(f"  skip {filepath.name}: {e}")
        return None

    if df.empty:
        return None

    df["event"] = df["event"].apply(decode_event)

    user_id, match_id, is_human = parse_filename(filepath.name)
    df["source_user_id"] = user_id
    df["source_match_id"] = match_id
    df["is_human"] = is_human
    df["date"] = filepath.parent.name  # February_10 etc.

    return df


# -----------------------------------------------------------------------------
# Pipeline
# -----------------------------------------------------------------------------


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PATHS_DIR.mkdir(parents=True, exist_ok=True)

    all_frames = []
    file_count = 0

    for day in DAYS:
        day_dir = DATA_DIR / day
        if not day_dir.exists():
            print(f"missing day dir: {day_dir}")
            continue

        files = sorted(day_dir.iterdir())
        print(f"{day}: {len(files)} files")

        for f in files:
            if f.is_dir():
                continue
            df = load_file(f)
            if df is None:
                continue
            all_frames.append(df)
            file_count += 1

    if not all_frames:
        print("no data loaded, abort")
        return

    print(f"\nloaded {file_count} files")
    full = pd.concat(all_frames, ignore_index=True)
    print(f"total rows: {len(full):,}")
    print(f"event distribution:")
    print(full["event"].value_counts())

    # Normalize match timestamps (per match, start at 0 seconds)
    full["ts_seconds"] = (
        full.groupby("source_match_id")["ts"]
        .transform(lambda s: (s - s.min()).dt.total_seconds())
    )

    # ---- Build events.json (markers only, drop Position events) -------------

    markers = full[full["event"].isin(MARKER_EVENTS)].copy()
    events_records = []
    for _, row in markers.iterrows():
        events_records.append(
            {
                "user_id": row["source_user_id"],
                "match_id": row["source_match_id"],
                "map_id": row["map_id"],
                "date": row["date"],
                "event": row["event"],
                "x": float(row["x"]),
                "z": float(row["z"]),
                "t": round(float(row["ts_seconds"]), 2),
                "is_human": bool(row["is_human"]),
            }
        )

    events_path = OUTPUT_DIR / "events.json"
    with open(events_path, "w") as f:
        json.dump(events_records, f, separators=(",", ":"))
    print(f"\nwrote {events_path} ({len(events_records):,} markers)")

    # ---- Build paths per match (sub-sampled Position events) ----------------

    positions = full[full["event"].isin(POSITION_EVENTS)].copy()
    paths_by_match = defaultdict(lambda: defaultdict(list))

    for match_id, match_df in positions.groupby("source_match_id"):
        match_df = match_df.sort_values("ts")
        # group by player within match
        for user_id, player_df in match_df.groupby("source_user_id"):
            # subsample
            sub = player_df.iloc[::POSITION_SUBSAMPLE]
            paths_by_match[match_id][user_id] = [
                {
                    "x": float(r["x"]),
                    "z": float(r["z"]),
                    "t": round(float(r["ts_seconds"]), 2),
                }
                for _, r in sub.iterrows()
            ]

    written = 0
    for match_id, players in paths_by_match.items():
        out = {
            "match_id": match_id,
            "map_id": positions[positions["source_match_id"] == match_id]["map_id"].iloc[0],
            "players": [
                {
                    "user_id": uid,
                    "is_human": bool(UUID_RE.match(uid)),
                    "points": pts,
                }
                for uid, pts in players.items()
            ],
        }
        # filename-safe match id
        safe = match_id.replace("/", "_")
        with open(PATHS_DIR / f"{safe}.json", "w") as f:
            json.dump(out, f, separators=(",", ":"))
        written += 1

    print(f"wrote {written} match path files to {PATHS_DIR}")

    # ---- Build metadata.json ------------------------------------------------

    matches_summary = []
    for match_id, match_df in full.groupby("source_match_id"):
        humans = match_df[match_df["is_human"]]["source_user_id"].nunique()
        bots = match_df[~match_df["is_human"]]["source_user_id"].nunique()
        kills = (match_df["event"].isin(["Kill", "BotKill"])).sum()
        storm_deaths = (match_df["event"] == "KilledByStorm").sum()
        duration = match_df["ts_seconds"].max()
        matches_summary.append(
            {
                "match_id": match_id,
                "map_id": match_df["map_id"].iloc[0],
                "date": match_df["date"].iloc[0],
                "humans": int(humans),
                "bots": int(bots),
                "kills": int(kills),
                "storm_deaths": int(storm_deaths),
                "duration_s": round(float(duration), 2) if pd.notna(duration) else 0,
            }
        )

    metadata = {
        "maps": [
            {"id": "AmbroseValley", "scale": 900, "origin_x": -370, "origin_z": -473, "minimap": "AmbroseValley_Minimap.png"},
            {"id": "GrandRift", "scale": 581, "origin_x": -290, "origin_z": -290, "minimap": "GrandRift_Minimap.png"},
            {"id": "Lockdown", "scale": 1000, "origin_x": -500, "origin_z": -500, "minimap": "Lockdown_Minimap.jpg"},
        ],
        "dates": DAYS,
        "matches": matches_summary,
        "totals": {
            "files": file_count,
            "events": int(len(full)),
            "markers": len(events_records),
            "paths": written,
            "unique_players": int(full["source_user_id"].nunique()),
        },
    }

    metadata_path = OUTPUT_DIR / "metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"wrote {metadata_path}")

    print("\ndone.")


if __name__ == "__main__":
    main()
