import React, { useState, useEffect, useRef } from 'react';
import {
  Scissors,
  Play,
  Pause,
  RotateCcw,
  Download,
  Repeat,
  Bell,
  Smartphone,
  Video,
  Instagram,
  Sparkles,
  Volume2,
  VolumeX,
  Sliders,
  CheckCircle2,
  PhoneCall,
  Loader2,
} from 'lucide-react';
import { AudioTrack, SnippetPreset } from '../types';
import { WaveformDisplay } from './WaveformDisplay';
import {
  getAudioContext,
  cutAudioSegment,
  audioBufferToWavBlob,
  formatTime,
} from '../utils/audioProcessing';

interface SnippetCutterProps {
  track: AudioTrack;
  activeBufferOverride?: AudioBuffer | null;
  stemSourceLabel?: string;
}

const PRESETS: SnippetPreset[] = [
  {
    id: 'ringtone',
    label: 'Phone Ringtone',
    duration: 30,
    icon: 'Smartphone',
    description: 'Standard 30-second loop tailored for incoming phone calls',
  },
  {
    id: 'notification',
    label: 'Text Alert',
    duration: 3.5,
    icon: 'Bell',
    description: 'Quick 3.5-second chime for SMS, WhatsApp, and app alerts',
  },
  {
    id: 'tiktok',
    label: 'TikTok / Reels',
    duration: 15,
    icon: 'Video',
    description: '15-second viral hook section for short-form social videos',
  },
  {
    id: 'reels',
    label: 'IG Story',
    duration: 30,
    icon: 'Instagram',
    description: '30-second clip ideal for Instagram Stories and status updates',
  },
  {
    id: 'teaser',
    label: '60s Teaser',
    duration: 60,
    icon: 'Sparkles',
    description: 'Extended 1-minute preview clip for teasers and promo reels',
  },
];

export const SnippetCutter: React.FC<SnippetCutterProps> = ({
  track,
  activeBufferOverride,
  stemSourceLabel = 'Original Track',
}) => {
  const currentBuffer = activeBufferOverride || track.audioBuffer;
  const duration = currentBuffer ? currentBuffer.duration : track.duration;

  // Cut points
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(Math.min(30, duration));
  const [fadeInSec, setFadeInSec] = useState(0.4);
  const [fadeOutSec, setFadeOutSec] = useState(0.8);
  const [isLooping, setIsLooping] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<string>('ringtone');
  const [customFilename, setCustomFilename] = useState('');

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [showRingtoneSimulator, setShowRingtoneSimulator] = useState(false);

  // Web audio playback node refs
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Set default filename on track change
  useEffect(() => {
    const cleanTitle = track.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const label = stemSourceLabel.toLowerCase().includes('instrumental') ? 'Instrumental' : 'Ringtone';
    setCustomFilename(`${cleanTitle}_${label}`);
    // Default initial selection: 0 to 30s
    setStartTime(0);
    setEndTime(Math.min(30, duration));
    pauseOffsetRef.current = 0;
  }, [track.id, stemSourceLabel, duration]);

  // Apply a duration preset
  const handleApplyPreset = (preset: SnippetPreset) => {
    setSelectedPreset(preset.id);
    const targetDur = Math.min(preset.duration, duration);
    // Align start and end
    const newEnd = Math.min(duration, startTime + targetDur);
    const newStart = Math.max(0, newEnd - targetDur);
    setStartTime(newStart);
    setEndTime(newEnd);
    pauseOffsetRef.current = newStart;
    setPlaybackTime(newStart);

    if (isPlaying) {
      stopPlayback();
      playSnippet(newStart);
    }
  };

  // Playback helpers
  const playSnippet = (offset = startTime) => {
    if (!currentBuffer) return;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    stopPlayback();

    const source = ctx.createBufferSource();
    source.buffer = currentBuffer;

    const gain = ctx.createGain();
    gain.gain.value = isMuted ? 0 : masterVolume;

    source.connect(gain);
    gain.connect(ctx.destination);

    sourceNodeRef.current = source;
    gainNodeRef.current = gain;

    const safeOffset = Math.max(startTime, Math.min(endTime, offset));
    startTimeRef.current = ctx.currentTime - safeOffset;
    pauseOffsetRef.current = safeOffset;

    const playDuration = Math.max(0.1, endTime - safeOffset);
    source.start(0, safeOffset, playDuration);
    setIsPlaying(true);

    source.onended = () => {
      if (isLooping) {
        // Continuous loop
        playSnippet(startTime);
      } else {
        setIsPlaying(false);
        setPlaybackTime(startTime);
        pauseOffsetRef.current = startTime;
      }
    };
  };

  const stopPlayback = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (_) {}
      sourceNodeRef.current = null;
    }
    const ctx = getAudioContext();
    pauseOffsetRef.current = Math.min(
      endTime,
      Math.max(startTime, ctx.currentTime - startTimeRef.current)
    );
    setIsPlaying(false);
  };

  // Playhead loop & progress monitor
  useEffect(() => {
    if (isPlaying) {
      const updateProgress = () => {
        const ctx = getAudioContext();
        const pos = ctx.currentTime - startTimeRef.current;
        if (pos >= endTime) {
          if (isLooping) {
            playSnippet(startTime);
          } else {
            stopPlayback();
            setPlaybackTime(startTime);
          }
        } else {
          setPlaybackTime(pos);
          animFrameRef.current = requestAnimationFrame(updateProgress);
        }
      };
      animFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, endTime, startTime, isLooping]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [track.id]);

  // Volume slider update
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : masterVolume;
    }
  }, [masterVolume, isMuted]);

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      playSnippet(pauseOffsetRef.current >= endTime ? startTime : pauseOffsetRef.current);
    }
  };

  const handleSeek = (newTime: number) => {
    // If user clicks outside current selection, move selection
    const segLength = endTime - startTime;
    if (newTime < startTime || newTime > endTime) {
      const newStart = Math.max(0, Math.min(duration - segLength, newTime));
      setStartTime(newStart);
      setEndTime(Math.min(duration, newStart + segLength));
      pauseOffsetRef.current = newStart;
      setPlaybackTime(newStart);
    } else {
      pauseOffsetRef.current = newTime;
      setPlaybackTime(newTime);
      if (isPlaying) {
        stopPlayback();
        playSnippet(newTime);
      }
    }
  };

  const handleRangeChange = (newStart: number, newEnd: number) => {
    setStartTime(newStart);
    setEndTime(newEnd);
    setSelectedPreset('custom');
    if (playbackTime < newStart || playbackTime > newEnd) {
      setPlaybackTime(newStart);
      pauseOffsetRef.current = newStart;
    }
  };

  // Adjust start or end by millisecond steps
  const stepTime = (type: 'start' | 'end', delta: number) => {
    if (type === 'start') {
      const target = Math.max(0, Math.min(endTime - 0.2, startTime + delta));
      setStartTime(target);
    } else {
      const target = Math.max(startTime + 0.2, Math.min(duration, endTime + delta));
      setEndTime(target);
    }
    setSelectedPreset('custom');
  };

  // Download cut segment as high-quality WAV
  const handleExportSegment = async () => {
    if (!currentBuffer) return;
    setIsExporting(true);
    setExportNotice('Exporting precision audio snippet...');

    try {
      const snippetBuffer = await cutAudioSegment(
        currentBuffer,
        startTime,
        endTime,
        fadeInSec,
        fadeOutSec
      );

      const blob = audioBufferToWavBlob(snippetBuffer);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const finalName = customFilename.trim() || 'Custom_Audio_Snippet';
      a.download = `${finalName}_${Math.round(endTime - startTime)}s.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportNotice('Snippet downloaded successfully!');
      setTimeout(() => setExportNotice(null), 3500);
    } catch (err: any) {
      console.error('Export snippet error:', err);
      setExportNotice('Failed to export snippet. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const segmentDuration = Math.max(0, endTime - startTime);

  return (
    <div className="w-full space-y-6">
      {/* Top Banner / Identity */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                Segment Cutter & Ringtone Maker
              </span>
              <span className="text-[11px] text-slate-400 px-2 py-0.5 rounded bg-slate-800 font-mono">
                Source: {stemSourceLabel}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
              {track.title}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Cut Length: <strong className="text-indigo-400 font-mono">{formatTime(segmentDuration)}</strong> (From {formatTime(startTime)} to {formatTime(endTime)})
            </p>
          </div>

          {/* Incoming Call Ringtone Simulator Toggle */}
          <button
            onClick={() => setShowRingtoneSimulator(!showRingtoneSimulator)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              showRingtoneSimulator
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <PhoneCall className={`w-3.5 h-3.5 ${showRingtoneSimulator ? 'text-emerald-400 animate-bounce' : ''}`} />
            {showRingtoneSimulator ? 'Hide Ring Simulator' : 'Preview as Incoming Call'}
          </button>
        </div>

        {/* Ringtone Simulator Visual Banner (when active) */}
        {showRingtoneSimulator && (
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950/60 to-slate-950 border border-indigo-500/30 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 animate-pulse">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Simulating Phone Ringtone</span>
                  {isPlaying && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  Ringtone segment is currently looping seamlessly with incoming call vibes
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs font-mono text-emerald-400 font-semibold block">
                {formatTime(playbackTime - startTime)} / {formatTime(segmentDuration)}
              </span>
              <span className="text-[10px] text-slate-500">Loop Mode Active</span>
            </div>
          </div>
        )}

        {/* Interactive Waveform with Draggable Start & End Handles */}
        <div className="mt-5">
          <WaveformDisplay
            peaks={track.peaks}
            currentTime={playbackTime}
            duration={duration}
            onSeek={handleSeek}
            selectionRange={{ start: startTime, end: endTime }}
            onRangeChange={handleRangeChange}
            showHandles={true}
            barColor="#334155"
            progressColor="#818cf8"
            height={110}
          />
        </div>

        {/* Transport & Scrub Bar Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              id="btn-play-pause-cutter"
              onClick={togglePlay}
              className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-transform active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Restart to Selection Start */}
            <button
              onClick={() => {
                pauseOffsetRef.current = startTime;
                setPlaybackTime(startTime);
                if (isPlaying) {
                  stopPlayback();
                  playSnippet(startTime);
                }
              }}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
              title="Replay from snippet start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Loop Toggle */}
            <button
              id="btn-toggle-loop"
              onClick={() => setIsLooping(!isLooping)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                isLooping
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Toggle continuous loop"
            >
              <Repeat className={`w-3.5 h-3.5 ${isLooping ? 'text-indigo-400' : ''}`} />
              Loop: {isLooping ? 'ON' : 'OFF'}
            </button>

            {/* Time display */}
            <div className="text-xs font-mono text-slate-300">
              <span className="font-semibold text-white">{formatTime(playbackTime)}</span>
              <span className="text-slate-500"> / {formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            >
              {isMuted || masterVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : masterVolume}
              onChange={(e) => {
                setMasterVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-24 accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Snippet Tuning & Format Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Presets for Ringtone & Social Media */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
            <Scissors className="w-4 h-4 text-purple-400" />
            Social & Ringtone Presets
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Click any format to snap the cut duration to standard social and phone lengths.
          </p>

          <div className="space-y-2">
            {PRESETS.map((preset) => {
              const isSelected = selectedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  id={`preset-${preset.id}`}
                  onClick={() => handleApplyPreset(preset)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-950/40 text-white shadow-md'
                      : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
                      {preset.id === 'ringtone' && <Smartphone className="w-4 h-4" />}
                      {preset.id === 'notification' && <Bell className="w-4 h-4" />}
                      {preset.id === 'tiktok' && <Video className="w-4 h-4" />}
                      {preset.id === 'reels' && <Instagram className="w-4 h-4" />}
                      {preset.id === 'teaser' && <Sparkles className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        {preset.label}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-purple-300 font-mono">
                          {preset.duration}s
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">{preset.description}</div>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: Millisecond Precision Sliders & Steppers */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            Millisecond Precision Trim
          </h3>

          {/* Start Point */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Start Time Marker</span>
              <span className="font-mono text-indigo-400 font-bold">{formatTime(startTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => stepTime('start', -0.5)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
              >
                -0.5s
              </button>
              <button
                onClick={() => stepTime('start', -0.1)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
              >
                -0.1s
              </button>
              <input
                type="range"
                min="0"
                max={Math.max(0.1, duration)}
                step="0.05"
                value={startTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  handleRangeChange(Math.min(val, endTime - 0.2), endTime);
                }}
                className="flex-1 accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              <button
                onClick={() => stepTime('start', 0.1)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
              >
                +0.1s
              </button>
              <button
                onClick={() => stepTime('start', 0.5)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
              >
                +0.5s
              </button>
            </div>
          </div>

          {/* End Point */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">End Time Marker</span>
              <span className="font-mono text-indigo-400 font-bold">{formatTime(endTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => stepTime('end', -0.5)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
              >
                -0.5s
              </button>
              <button
                onClick={() => stepTime('end', -0.1)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
              >
                -0.1s
              </button>
              <input
                type="range"
                min="0"
                max={Math.max(0.1, duration)}
                step="0.05"
                value={endTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  handleRangeChange(startTime, Math.max(val, startTime + 0.2));
                }}
                className="flex-1 accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              <button
                onClick={() => stepTime('end', 0.1)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
              >
                +0.1s
              </button>
              <button
                onClick={() => stepTime('end', 0.5)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
              >
                +0.5s
              </button>
            </div>
          </div>

          {/* Fade In & Fade Out Envelope */}
          <div className="pt-2 grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Fade In</span>
                <span className="font-mono text-slate-200">{fadeInSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={fadeInSec}
                onChange={(e) => setFadeInSec(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Fade Out</span>
                <span className="font-mono text-slate-200">{fadeOutSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={fadeOutSec}
                onChange={(e) => setFadeOutSec(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Column 3: Custom Filename & Export Station */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-emerald-400" />
              Download & Export
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Exports a pristine 16-bit PCM 44.1kHz WAV ready for iPhone/Android ringtones or video editors.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Snippet File Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customFilename}
                    onChange={(e) => setCustomFilename(e.target.value)}
                    placeholder="My_Awesome_Ringtone"
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                    .wav
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Clip Duration:</span>
                  <span className="font-mono text-white font-semibold">
                    {formatTime(segmentDuration)} ({segmentDuration.toFixed(2)}s)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Envelope Fades:</span>
                  <span className="font-mono text-slate-300">
                    +{fadeInSec}s in / -{fadeOutSec}s out
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Audio Format:</span>
                  <span className="font-mono text-slate-300">16-bit 44.1kHz Stereo WAV</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2">
            <button
              id="btn-download-snippet"
              onClick={handleExportSegment}
              disabled={isExporting}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Rendering Master Audio...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Cut Ringtone / Snippet (.wav)
                </>
              )}
            </button>

            {exportNotice && (
              <p className="text-[11px] text-emerald-400 text-center font-medium">
                {exportNotice}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
