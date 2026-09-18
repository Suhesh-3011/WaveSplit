import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Scissors,
  Sliders,
  Mic,
  Music,
  ShieldCheck,
  Radio,
  Layers,
  Sparkles,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { AudioTrack, PlaybackMode, StemSettings } from '../types';
import { WaveformDisplay } from './WaveformDisplay';
import {
  getAudioContext,
  processStemsOffline,
  audioBufferToWavBlob,
  formatTime,
} from '../utils/audioProcessing';

interface VocalIsolatorProps {
  track: AudioTrack;
  onSendToCutter: (processedBuffer: AudioBuffer, modeName: string) => void;
}

export const VocalIsolator: React.FC<VocalIsolatorProps> = ({ track, onSendToCutter }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isProcessingExport, setIsProcessingExport] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Stem configuration
  const [stemSettings, setStemSettings] = useState<StemSettings>({
    instrumentalVolume: 1.0,
    vocalVolume: 0.0,
    vocalRemovalDepth: 0.98,
    bassPreserve: true,
    highPreserve: true,
    mode: 'instrumental',
  });

  // Cached processed audio buffers for instant seamless playback switching
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [isRegeneratingStem, setIsRegeneratingStem] = useState(false);

  // Web Audio playback nodes
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Update processed stem whenever settings change or new track loaded
  useEffect(() => {
    let isCancelled = false;

    const renderCurrentStem = async () => {
      if (!track.audioBuffer) return;
      setIsRegeneratingStem(true);

      try {
        const rendered = await processStemsOffline(track.audioBuffer, {
          mode: stemSettings.mode,
          instrumentalLevel: stemSettings.instrumentalVolume,
          vocalLevel: stemSettings.vocalVolume,
          vocalRemovalDepth: stemSettings.vocalRemovalDepth,
          preserveBass: stemSettings.bassPreserve,
          preserveHighs: stemSettings.highPreserve,
        });

        if (!isCancelled) {
          setProcessedBuffer(rendered);

          // If currently playing, hot-swap buffer smoothly
          if (isPlaying) {
            const currentPosition = pauseOffsetRef.current;
            stopAudio();
            playAudio(rendered, currentPosition);
          }
        }
      } catch (err) {
        console.error('Stem rendering error:', err);
      } finally {
        if (!isCancelled) {
          setIsRegeneratingStem(false);
        }
      }
    };

    renderCurrentStem();

    return () => {
      isCancelled = true;
    };
  }, [
    track.id,
    stemSettings.mode,
    stemSettings.instrumentalVolume,
    stemSettings.vocalVolume,
    stemSettings.vocalRemovalDepth,
    stemSettings.bassPreserve,
    stemSettings.highPreserve,
  ]);

  // Audio Playback Helpers
  const playAudio = (bufferToPlay: AudioBuffer, offsetSec = 0) => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Stop existing node
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (_) {}
    }

    const source = ctx.createBufferSource();
    source.buffer = bufferToPlay;

    const gain = ctx.createGain();
    gain.gain.value = isMuted ? 0 : masterVolume;

    source.connect(gain);
    gain.connect(ctx.destination);

    sourceNodeRef.current = source;
    gainNodeRef.current = gain;

    const clampedOffset = Math.max(0, Math.min(bufferToPlay.duration, offsetSec));
    startTimeRef.current = ctx.currentTime - clampedOffset;
    pauseOffsetRef.current = clampedOffset;

    source.start(0, clampedOffset);
    setIsPlaying(true);

    source.onended = () => {
      // Natural track finish
      if (ctx.currentTime - startTimeRef.current >= bufferToPlay.duration - 0.2) {
        setIsPlaying(false);
        pauseOffsetRef.current = 0;
        setCurrentTime(0);
      }
    };
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (_) {}
      sourceNodeRef.current = null;
    }
    const ctx = getAudioContext();
    pauseOffsetRef.current = Math.min(
      track.duration,
      Math.max(0, ctx.currentTime - startTimeRef.current)
    );
    setIsPlaying(false);
  };

  // Playhead progress tracker
  useEffect(() => {
    if (isPlaying) {
      const updateProgress = () => {
        const ctx = getAudioContext();
        const pos = ctx.currentTime - startTimeRef.current;
        setCurrentTime(Math.min(track.duration, pos));
        animFrameRef.current = requestAnimationFrame(updateProgress);
      };
      animFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, track.duration]);

  // Cleanup on unmount or track change
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [track.id]);

  // Volume change
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : masterVolume;
    }
  }, [masterVolume, isMuted]);

  const togglePlay = () => {
    const buf = processedBuffer || track.audioBuffer;
    if (!buf) return;

    if (isPlaying) {
      stopAudio();
    } else {
      playAudio(buf, pauseOffsetRef.current);
    }
  };

  const handleSeek = (newTime: number) => {
    pauseOffsetRef.current = newTime;
    setCurrentTime(newTime);
    if (isPlaying) {
      const buf = processedBuffer || track.audioBuffer;
      if (buf) {
        stopAudio();
        playAudio(buf, newTime);
      }
    }
  };

  // Set preset modes
  const applyPreset = (mode: PlaybackMode) => {
    if (mode === 'instrumental') {
      setStemSettings((prev) => ({
        ...prev,
        mode: 'instrumental',
        instrumentalVolume: 1.0,
        vocalVolume: 0.0,
        vocalRemovalDepth: 0.98,
        bassPreserve: true,
        highPreserve: true,
      }));
    } else if (mode === 'vocal') {
      setStemSettings((prev) => ({
        ...prev,
        mode: 'vocal',
        instrumentalVolume: 0.0,
        vocalVolume: 1.0,
        vocalRemovalDepth: 0.98,
        bassPreserve: false,
        highPreserve: false,
      }));
    } else if (mode === 'original') {
      setStemSettings((prev) => ({
        ...prev,
        mode: 'original',
        instrumentalVolume: 1.0,
        vocalVolume: 1.0,
      }));
    } else {
      setStemSettings((prev) => ({
        ...prev,
        mode: 'custom',
      }));
    }
  };

  // Download High-Quality Rendered Stem (.wav)
  const handleDownloadWav = async (downloadMode: 'instrumental' | 'vocal') => {
    if (!track.audioBuffer) return;
    setIsProcessingExport(true);
    setExportMessage(`Rendering lossless ${downloadMode} master...`);

    try {
      const rendered = await processStemsOffline(track.audioBuffer, {
        mode: downloadMode,
        instrumentalLevel: downloadMode === 'instrumental' ? 1.0 : 0.0,
        vocalLevel: downloadMode === 'vocal' ? 1.0 : 0.0,
        vocalRemovalDepth: 0.98,
        preserveBass: downloadMode === 'instrumental',
        preserveHighs: downloadMode === 'instrumental',
      });

      const wavBlob = audioBufferToWavBlob(rendered);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      const cleanTitle = track.title.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${cleanTitle}_${downloadMode.toUpperCase()}_44.1kHz.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportMessage(`Successfully downloaded ${downloadMode} track!`);
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err: any) {
      console.error('Export error:', err);
      setExportMessage('Export failed. Please try again.');
    } finally {
      setIsProcessingExport(false);
    }
  };

  // Forward current stem to Snippet Cutter
  const handleSendActiveToCutter = () => {
    const bufferToUse = processedBuffer || track.audioBuffer;
    if (!bufferToUse) return;
    const modeLabel =
      stemSettings.mode === 'instrumental'
        ? 'Instrumental Stem'
        : stemSettings.mode === 'vocal'
        ? 'Isolated Vocal Stem'
        : 'Full Mix';
    onSendToCutter(bufferToUse, modeLabel);
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Banner / Track Identity */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Stem Separation DSP
              </span>
              {isRegeneratingStem && (
                <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Updating filter...
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
              {track.title}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {track.artist} • Duration: {formatTime(track.duration)} • 44.1 kHz Stereo
            </p>
          </div>

          {/* Action: Send to Snippet Cutter */}
          <button
            id="btn-send-to-cutter"
            onClick={handleSendActiveToCutter}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Scissors className="w-4 h-4" />
            Cut Ringtone / Snippet
          </button>
        </div>

        {/* Waveform Scrubber */}
        <div className="mt-5">
          <WaveformDisplay
            peaks={track.peaks}
            currentTime={currentTime}
            duration={track.duration}
            onSeek={handleSeek}
            barColor="#334155"
            progressColor={stemSettings.mode === 'instrumental' ? '#6366f1' : stemSettings.mode === 'vocal' ? '#ec4899' : '#10b981'}
            height={88}
          />
        </div>

        {/* Transport Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              id="btn-play-pause-isolator"
              onClick={togglePlay}
              className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-transform active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Restart */}
            <button
              onClick={() => handleSeek(0)}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
              title="Restart from beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Time display */}
            <div className="text-xs font-mono text-slate-300">
              <span className="font-semibold text-white">{formatTime(currentTime)}</span>
              <span className="text-slate-500"> / {formatTime(track.duration)}</span>
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

      {/* Stem Separation Control Station */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Preset Switcher & Direct Stem Exports */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-indigo-400" />
              Stem Solo Presets
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Instantly toggle the acoustic model between instrumental creation and vocal isolation.
            </p>

            <div className="space-y-2.5">
              {/* Preset 1: Instrumental */}
              <button
                id="preset-instrumental"
                onClick={() => applyPreset('instrumental')}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                  stemSettings.mode === 'instrumental'
                    ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-md shadow-indigo-950/50'
                    : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Instrumental (Vocal Removed)</div>
                    <div className="text-[11px] text-slate-400">Clean backing track, bass & air preserved</div>
                  </div>
                </div>
                {stemSettings.mode === 'instrumental' && (
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                )}
              </button>

              {/* Preset 2: Vocal Stem */}
              <button
                id="preset-vocal"
                onClick={() => applyPreset('vocal')}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                  stemSettings.mode === 'vocal'
                    ? 'border-pink-500 bg-pink-950/40 text-white shadow-md shadow-pink-950/50'
                    : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-300 flex items-center justify-center shrink-0">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Isolated Vocal (Acapella)</div>
                    <div className="text-[11px] text-slate-400">Center-channel lead vocal extraction</div>
                  </div>
                </div>
                {stemSettings.mode === 'vocal' && (
                  <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />
                )}
              </button>

              {/* Preset 3: Original Mix */}
              <button
                id="preset-original"
                onClick={() => applyPreset('original')}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                  stemSettings.mode === 'original'
                    ? 'border-emerald-500 bg-emerald-950/40 text-white shadow-md shadow-emerald-950/50'
                    : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Original Full Mix</div>
                    <div className="text-[11px] text-slate-400">Standard stereo reference</div>
                  </div>
                </div>
                {stemSettings.mode === 'original' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Quick Stem WAV Download Section */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Direct Lossless WAV Export:
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-download-instrumental"
                onClick={() => handleDownloadWav('instrumental')}
                disabled={isProcessingExport}
                className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Instrumental
              </button>

              <button
                id="btn-download-vocal"
                onClick={() => handleDownloadWav('vocal')}
                disabled={isProcessingExport}
                className="px-3 py-2 bg-pink-600/20 hover:bg-pink-600 border border-pink-500/30 text-pink-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Vocal Stem
              </button>
            </div>

            {exportMessage && (
              <p className="text-[11px] text-indigo-300 text-center font-medium mt-1">
                {exportMessage}
              </p>
            )}
          </div>
        </div>

        {/* Right Column (Span 2): Advanced DSP Sliders & Acoustic Tuning */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Custom Stem Balance & Acoustic DSP
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              32-Bit Floating Point
            </span>
          </div>

          {/* Slider 1: Instrumental Level */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-indigo-400" />
                Instrumental Level
              </span>
              <span className="font-mono text-indigo-400">
                {Math.round(stemSettings.instrumentalVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={stemSettings.instrumentalVolume}
              onChange={(e) => {
                setStemSettings((prev) => ({
                  ...prev,
                  mode: 'custom',
                  instrumentalVolume: parseFloat(e.target.value),
                }));
              }}
              className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Slider 2: Vocal Level */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-pink-400" />
                Vocal Level
              </span>
              <span className="font-mono text-pink-400">
                {Math.round(stemSettings.vocalVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={stemSettings.vocalVolume}
              onChange={(e) => {
                setStemSettings((prev) => ({
                  ...prev,
                  mode: 'custom',
                  vocalVolume: parseFloat(e.target.value),
                }));
              }}
              className="w-full accent-pink-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Slider 3: Vocal Cancellation Depth */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Phase Cancellation Depth
              </span>
              <span className="font-mono text-emerald-400">
                {Math.round(stemSettings.vocalRemovalDepth * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.01"
              value={stemSettings.vocalRemovalDepth}
              onChange={(e) => {
                setStemSettings((prev) => ({
                  ...prev,
                  vocalRemovalDepth: parseFloat(e.target.value),
                }));
              }}
              className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              Higher depth eliminates center vocal formants aggressively; adjust slightly lower if backing instruments have wide stereo bleed.
            </p>
          </div>

          {/* Toggle Filters: Sub-Bass & High Air */}
          <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={stemSettings.bassPreserve}
                onChange={(e) =>
                  setStemSettings((prev) => ({ ...prev, bassPreserve: e.target.checked }))
                }
                className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  Preserve Sub-Bass (&lt;180 Hz)
                </span>
                <span className="text-[10px] text-slate-400">
                  Crossover low-pass filter shields kick and 808 bass from vocal phase cancellation.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={stemSettings.highPreserve}
                onChange={(e) =>
                  setStemSettings((prev) => ({ ...prev, highPreserve: e.target.checked }))
                }
                className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  Preserve Stereo Air (&gt;8 kHz)
                </span>
                <span className="text-[10px] text-slate-400">
                  Retains shimmer of cymbals, acoustic guitar pick transients, and stereo room reverbs.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
