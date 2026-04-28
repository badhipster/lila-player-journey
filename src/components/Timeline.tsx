"use client";

/**
 * Timeline — match-replay scrubber with play/pause.
 *
 * The dataset's per-match `t` values are normalised seconds-since-match-start
 * but the underlying clock is compressed (typical match span is ~0.5-1.0
 * "seconds"). Rather than pretending these are real seconds, we render the
 * label as "Match clock" and let the user scrub the full range. Playback is
 * paced over a fixed real-world wall time (PLAY_SECONDS) so very short
 * matches don't fly by in one frame.
 */

import { useEffect, useRef, useState } from "react";

const PLAY_SECONDS = 10; // real-world seconds for one full match playback
const TICK_MS = 50;

interface Props {
  duration: number; // max t in the selected match
  value: number; // current cutoff t
  onChange: (t: number) => void;
  /** Disable controls when no match is selected. */
  disabled?: boolean;
}

export default function Timeline({
  duration,
  value,
  onChange,
  disabled = false,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(playing);
  const valueRef = useRef(value);
  const durationRef = useRef(duration);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Auto-pause when the match changes.
  useEffect(() => {
    setPlaying(false);
  }, [duration]);

  // Tick loop.
  useEffect(() => {
    if (!playing || disabled) return;
    const step = durationRef.current / (PLAY_SECONDS * (1000 / TICK_MS));
    const id = window.setInterval(() => {
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

  const pct = duration > 0 ? Math.min(100, (value / duration) * 100) : 0;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <button
        onClick={() => setPlaying((p) => !p)}
        disabled={disabled || duration === 0}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 text-sm hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={playing ? "Pause" : "Play"}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? "❚❚" : "▶"}
      </button>

      <button
        onClick={() => {
          setPlaying(false);
          onChange(0);
        }}
        disabled={disabled || duration === 0}
        className="flex h-8 items-center rounded-md border border-neutral-700 bg-neutral-950 px-2 text-xs hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ↺ Reset
      </button>

      <input
        type="range"
        min={0}
        max={Math.max(duration, 0.001)}
        step={duration > 0 ? duration / 1000 : 0.001}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled || duration === 0}
        className="flex-1 accent-neutral-300"
      />

      <div className="w-32 shrink-0 text-right font-mono text-[11px] text-neutral-400">
        {disabled || duration === 0 ? (
          <span>— pick a match —</span>
        ) : (
          <>
            t = <span className="text-neutral-200">{value.toFixed(3)}</span> /{" "}
            {duration.toFixed(3)} ({pct.toFixed(0)}%)
          </>
        )}
      </div>
    </div>
  );
}
