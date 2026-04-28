"use client";

/**
 * Timeline — match-replay scrubber with play/pause and speed controls.
 *
 * The dataset's per-match `t` values are normalised seconds-since-match-start
 * but the underlying clock is compressed (typical match span is ~0.5-1.0
 * "seconds"). Rather than pretending these are real seconds, we render the
 * label as "Match clock" and let the user scrub the full range. Playback is
 * paced over a fixed real-world wall time (BASE_PLAY_SECONDS) so very short
 * matches don't fly by in one frame.
 *
 * Speed controls let the user replay at 0.5×, 1×, 2×, or 4× speed.
 * Step buttons move ±1% of match duration for fine scrubbing.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const BASE_PLAY_SECONDS = 10; // real-world seconds for one full match at 1× speed
const TICK_MS = 50;
const SPEED_OPTIONS = [0.5, 1, 2, 4] as const;

/** A single event surfaced as a tick on the scrubber. */
export interface TimelineMark {
  t: number;
  /** Color hint: 'kill' | 'death' | 'loot' | 'storm' */
  kind: "kill" | "death" | "loot" | "storm";
}

interface Props {
  duration: number; // max t in the selected match
  value: number; // current cutoff t
  onChange: (t: number) => void;
  /** Tick marks rendered above the scrubber. */
  marks?: TimelineMark[];
  /** Disable controls when no match is selected. */
  disabled?: boolean;
}

const MARK_COLOR: Record<TimelineMark["kind"], string> = {
  kill: "#ef4444",
  death: "#7f1d1d",
  loot: "#facc15",
  storm: "#a855f7",
};

export default function Timeline({
  duration,
  value,
  onChange,
  marks = [],
  disabled = false,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const playingRef = useRef(playing);
  const valueRef = useRef(value);
  const durationRef = useRef(duration);
  const speedRef = useRef(speed);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Auto-pause when the match changes.
  useEffect(() => {
    setPlaying(false);
  }, [duration]);

  // Tick loop — speed-aware.
  useEffect(() => {
    if (!playing || disabled) return;
    const id = window.setInterval(() => {
      const effectivePlayTime = BASE_PLAY_SECONDS / speedRef.current;
      const step = durationRef.current / (effectivePlayTime * (1000 / TICK_MS));
      const next = valueRef.current + step;
      if (next >= durationRef.current) {
        onChange(durationRef.current);
        setPlaying(false);
      } else {
        onChange(next);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, disabled, onChange]);

  const stepForward = useCallback(() => {
    if (disabled || duration === 0) return;
    onChange(Math.min(duration, value + duration * 0.01));
  }, [disabled, duration, value, onChange]);

  const stepBackward = useCallback(() => {
    if (disabled || duration === 0) return;
    onChange(Math.max(0, value - duration * 0.01));
  }, [disabled, duration, value, onChange]);

  const pct = duration > 0 ? Math.min(100, (value / duration) * 100) : 0;

  return (
    <div
      className={`rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 transition-opacity ${
        disabled ? "opacity-40" : ""
      }`}
    >
      {/* Top row: controls + scrubber */}
      <div className="flex items-center gap-2">
        {/* Play / Pause */}
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={disabled || duration === 0}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 text-sm transition-colors hover:border-emerald-600 hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>

        {/* Step backward */}
        <button
          onClick={stepBackward}
          disabled={disabled || duration === 0}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 text-xs transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
          title="Step backward 1%"
        >
          ⏮
        </button>

        {/* Step forward */}
        <button
          onClick={stepForward}
          disabled={disabled || duration === 0}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 text-xs transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
          title="Step forward 1%"
        >
          ⏭
        </button>

        {/* Reset */}
        <button
          onClick={() => {
            setPlaying(false);
            onChange(0);
          }}
          disabled={disabled || duration === 0}
          className="flex h-8 shrink-0 items-center rounded-md border border-neutral-700 bg-neutral-950 px-2 text-xs transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ↺
        </button>

        {/* Scrubber */}
        <div className="relative flex-1 min-w-0">
          {/* Tick marks for events */}
          {!disabled && duration > 0 && marks.length > 0 ? (
            <div className="pointer-events-none absolute inset-x-0 -top-2.5 h-2.5">
              {marks.map((mk, i) => (
                <span
                  key={i}
                  className="absolute top-0 h-2 w-[2px] rounded-sm"
                  style={{
                    left: `${(mk.t / duration) * 100}%`,
                    backgroundColor: MARK_COLOR[mk.kind],
                    opacity: 0.85,
                  }}
                  title={`${mk.kind} @ t=${mk.t.toFixed(3)}`}
                />
              ))}
            </div>
          ) : null}
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.001)}
            step={duration > 0 ? duration / 1000 : 0.001}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            disabled={disabled || duration === 0}
            className="w-full accent-emerald-400"
          />
        </div>

        {/* Time display */}
        <div className="w-28 shrink-0 text-right font-mono text-[11px] text-neutral-400">
          {disabled || duration === 0 ? (
            <span className="text-neutral-600">— pick a match —</span>
          ) : (
            <>
              <span className="text-neutral-200">{pct.toFixed(0)}%</span>{" "}
              <span className="text-neutral-500">
                ({value.toFixed(3)})
              </span>
            </>
          )}
        </div>
      </div>

      {/* Bottom row: speed selector */}
      {!disabled && duration > 0 ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
            Speed
          </span>
          <div className="flex gap-1">
            {SPEED_OPTIONS.map((s) => {
              const active = speed === s;
              return (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                      : "border border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600"
                  }`}
                >
                  {s}×
                </button>
              );
            })}
          </div>
          <div className="ml-auto text-[10px] text-neutral-600">
            {playing ? (
              <span className="text-emerald-400">● Playing {speed}×</span>
            ) : (
              "Paused"
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
