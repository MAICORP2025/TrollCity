import React from 'react';

interface DrivingHUDProps {
  destinationName: string;
  distanceRemaining: number;
  etaSeconds: number;
  speedKph: number;
  progress: number;
  showDriveHint: boolean;
}

export function DrivingHUD({
  destinationName,
  distanceRemaining,
  etaSeconds,
  speedKph,
  progress,
  showDriveHint
}: DrivingHUDProps) {
  const distanceDisplay = `${Math.max(0, Math.round(distanceRemaining))} m`;
  const etaDisplay =
    etaSeconds <= 0 ? 'Arriving' : `${Math.max(1, Math.round(etaSeconds))} s`;

  const speedDisplay = `${Math.round(speedKph)} km/h`;
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <>
      <div className="pointer-events-none absolute top-5 left-5 px-4 py-2 rounded-lg bg-black/60 border border-white/15 text-xs sm:text-sm text-white flex flex-col">
        <span className="uppercase tracking-[0.18em] text-[10px] text-gray-300">
          Destination
        </span>
        <span className="font-semibold text-sm sm:text-base">
          {destinationName}
        </span>
      </div>

      <div className="pointer-events-none absolute top-5 right-5 px-4 py-2 rounded-lg bg-black/60 border border-white/15 text-xs sm:text-sm text-white flex flex-col items-end">
        <div className="flex gap-2 items-baseline">
          <span className="text-gray-300 text-[10px] uppercase tracking-[0.18em]">
            Distance
          </span>
          <span className="font-semibold text-sm sm:text-base">
            {distanceDisplay}
          </span>
        </div>
        <div className="flex gap-2 items-baseline">
          <span className="text-gray-300 text-[10px] uppercase tracking-[0.18em]">
            ETA
          </span>
          <span className="font-semibold text-sm sm:text-base">
            {etaDisplay}
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 w-72 sm:w-96 px-4 py-3 rounded-2xl bg-black/70 border border-white/15 text-xs sm:text-sm text-white flex flex-col gap-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-[0.2em] text-[10px] text-gray-300">
            Speed
          </span>
          <span className="font-semibold text-sm sm:text-base">
            {speedDisplay}
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 shadow-[0_0_15px_rgba(34,197,235,0.7)] transition-all duration-150 ease-linear"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>

      {showDriveHint && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 border border-white/15 text-[11px] sm:text-xs text-gray-100 flex items-center gap-2">
          <span className="font-semibold tracking-wide">
            Press W / ↑ to drive
          </span>
          <span className="text-gray-400 hidden sm:inline">
            A / D to steer
          </span>
        </div>
      )}
    </>
  );
}

