import React, { useRef } from 'react';
import { formatTime } from '../utils/audioProcessing';

interface WaveformDisplayProps {
  peaks: number[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  selectionRange?: { start: number; end: number };
  onRangeChange?: (start: number, end: number) => void;
  showHandles?: boolean;
  barColor?: string;
  progressColor?: string;
  height?: number;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  peaks,
  currentTime,
  duration,
  onSeek,
  selectionRange,
  onRangeChange,
  showHandles = false,
  barColor = '#334155', // slate-700
  progressColor = '#6366f1', // indigo-500
  height = 96,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const safeDuration = duration > 0 ? duration : 1;
  const progressRatio = Math.max(0, Math.min(1, currentTime / safeDuration));

  const startRatio = selectionRange ? Math.max(0, Math.min(1, selectionRange.start / safeDuration)) : 0;
  const endRatio = selectionRange ? Math.max(0, Math.min(1, selectionRange.end / safeDuration)) : 1;

  // Handle click to seek
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || safeDuration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * safeDuration);
  };

  // Dragging start/end handles for snippet cutter
  const handleDrag = (handleType: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current || !onRangeChange || !selectionRange) return;

    const rect = containerRef.current.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, currentX / rect.width));
      const targetTime = ratio * safeDuration;

      if (handleType === 'start') {
        const newStart = Math.min(targetTime, selectionRange.end - 0.5);
        onRangeChange(Math.max(0, newStart), selectionRange.end);
      } else {
        const newEnd = Math.max(targetTime, selectionRange.start + 0.5);
        onRangeChange(selectionRange.start, Math.min(safeDuration, newEnd));
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="relative w-full rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer select-none overflow-hidden group shadow-inner"
      style={{ height: `${height}px` }}
    >
      {/* Waveform Bars Container */}
      <div className="absolute inset-0 flex items-center justify-between px-2 gap-0.5 pointer-events-none">
        {peaks.map((peak, index) => {
          const barRatio = index / peaks.length;
          const isPlayed = barRatio <= progressRatio;
          const isInSelection =
            selectionRange && barRatio >= startRatio && barRatio <= endRatio;

          // Color calculation
          let fill = barColor;
          if (showHandles) {
            if (isInSelection) {
              fill = isPlayed ? '#818cf8' : '#4f46e5'; // bright indigo
            } else {
              fill = '#1e293b'; // dimmed outside selection
            }
          } else {
            fill = isPlayed ? progressColor : barColor;
          }

          const barHeightPercent = Math.max(12, Math.round(peak * 92));

          return (
            <div
              key={index}
              className="flex-1 rounded-full transition-colors duration-75"
              style={{
                height: `${barHeightPercent}%`,
                backgroundColor: fill,
              }}
            />
          );
        })}
      </div>

      {/* Dimmed backdrop outside snippet cut range */}
      {showHandles && selectionRange && (
        <>
          {/* Dimmed Left */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-slate-950/70 pointer-events-none border-r border-indigo-500/40"
            style={{ width: `${startRatio * 100}%` }}
          />

          {/* Active Highlight Band */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none bg-indigo-500/10 border-y border-indigo-500/40"
            style={{
              left: `${startRatio * 100}%`,
              width: `${(endRatio - startRatio) * 100}%`,
            }}
          />

          {/* Dimmed Right */}
          <div
            className="absolute top-0 bottom-0 right-0 bg-slate-950/70 pointer-events-none border-l border-indigo-500/40"
            style={{ width: `${(1 - endRatio) * 100}%` }}
          />

          {/* Draggable Start Handle */}
          <div
            onMouseDown={(e) => handleDrag('start', e)}
            className="absolute top-0 bottom-0 z-20 w-4 -ml-2 cursor-ew-resize flex items-center justify-center group/handle"
            style={{ left: `${startRatio * 100}%` }}
          >
            <div className="w-1.5 h-full bg-indigo-500 group-hover/handle:bg-indigo-400 group-hover/handle:w-2 transition-all shadow-md flex items-center justify-center">
              <div className="w-0.5 h-6 bg-white/80 rounded" />
            </div>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-mono whitespace-nowrap shadow opacity-0 group-hover/handle:opacity-100 transition-opacity">
              {formatTime(selectionRange.start)}
            </div>
          </div>

          {/* Draggable End Handle */}
          <div
            onMouseDown={(e) => handleDrag('end', e)}
            className="absolute top-0 bottom-0 z-20 w-4 -ml-2 cursor-ew-resize flex items-center justify-center group/handle"
            style={{ left: `${endRatio * 100}%` }}
          >
            <div className="w-1.5 h-full bg-indigo-500 group-hover/handle:bg-indigo-400 group-hover/handle:w-2 transition-all shadow-md flex items-center justify-center">
              <div className="w-0.5 h-6 bg-white/80 rounded" />
            </div>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-mono whitespace-nowrap shadow opacity-0 group-hover/handle:opacity-100 transition-opacity">
              {formatTime(selectionRange.end)}
            </div>
          </div>
        </>
      )}

      {/* Real-time Playhead Indicator */}
      <div
        className="absolute top-0 bottom-0 z-10 w-0.5 bg-white shadow-lg pointer-events-none transition-all duration-75"
        style={{ left: `${progressRatio * 100}%` }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-white -ml-1 -mt-0.5 shadow-md border border-indigo-600" />
      </div>

      {/* Floating Time Display in bottom corner */}
      <div className="absolute bottom-1.5 right-2 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-400 pointer-events-none">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  );
};
