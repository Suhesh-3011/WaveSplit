import React, { useState, useRef } from 'react';
import { Upload, Link2, Search, Play, Disc, ArrowRight, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { AudioTrack } from '../types';
import { CURATED_LIBRARY, CuratedTrack } from '../utils/demoTracks';
import { decodeAudioData, extractPeaks, createSyntheticDemoTrack, formatTime } from '../utils/audioProcessing';

interface AudioInputSectionProps {
  onTrackLoaded: (track: AudioTrack) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  activeTrackId?: string;
}

export const AudioInputSection: React.FC<AudioInputSectionProps> = ({
  onTrackLoaded,
  isLoading,
  setIsLoading,
  activeTrackId,
}) => {
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'link' | 'search'>('upload');
  const [linkUrl, setLinkUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter curated songs by title, artist, genre, or tag
  const filteredLibrary = CURATED_LIBRARY.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.artist.toLowerCase().includes(q) ||
      item.genre.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  // Handle local audio file selection
  const handleFile = async (file: File) => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await decodeAudioData(arrayBuffer);
      const peaks = extractPeaks(audioBuffer, 160);

      const track: AudioTrack = {
        id: `file-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Uploaded Audio',
        duration: audioBuffer.duration,
        audioBuffer,
        audioBlob: file,
        sourceType: 'upload',
        peaks,
      };

      onTrackLoaded(track);
    } catch (err: any) {
      console.error('Failed to parse audio file:', err);
      setErrorMessage(
        'Unable to decode this audio file. Please ensure it is a valid MP3, WAV, OGG, or AAC audio file.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle URL fetch via server proxy
  const handleFetchUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!linkUrl.trim()) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/fetch-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${res.status}`);
      }

      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await decodeAudioData(arrayBuffer);
      const peaks = extractPeaks(audioBuffer, 160);

      // Guess title from url filename
      let title = 'Web Audio Track';
      try {
        const parsed = new URL(linkUrl);
        const segments = parsed.pathname.split('/');
        const last = segments[segments.length - 1];
        if (last && last.includes('.')) {
          title = decodeURIComponent(last.replace(/\.[^/.]+$/, ''));
        }
      } catch (_) {}

      const track: AudioTrack = {
        id: `url-${Date.now()}`,
        title,
        artist: 'Online Source',
        duration: audioBuffer.duration,
        audioBuffer,
        audioBlob: blob,
        sourceType: 'url',
        originalUrl: linkUrl,
        peaks,
      };

      onTrackLoaded(track);
    } catch (err: any) {
      console.error('Failed to load link audio:', err);
      setErrorMessage(err.message || 'Could not load audio from URL. Please check the link or try another.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle loading a demo or searched song
  const handleLoadCuratedTrack = async (item: CuratedTrack) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      let audioBuffer: AudioBuffer;
      let blob: Blob | undefined;

      if (item.publicUrl) {
        // Fetch public audio
        const res = await fetch('/api/fetch-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.publicUrl }),
        });
        const fetchedBlob = await res.blob();
        blob = fetchedBlob;
        const arrayBuf = await fetchedBlob.arrayBuffer();
        audioBuffer = await decodeAudioData(arrayBuf);
      } else {
        // High quality client-side synthesized multi-track demo with centered lead vocals and stereo backings
        audioBuffer = createSyntheticDemoTrack(item.generatorType);
      }

      const peaks = extractPeaks(audioBuffer, 160);
      const track: AudioTrack = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        duration: audioBuffer.duration,
        audioBuffer,
        audioBlob: blob,
        sourceType: 'demo',
        peaks,
      };

      onTrackLoaded(track);
    } catch (err: any) {
      console.error('Failed to load demo track:', err);
      setErrorMessage('Failed to load selected track. Please try another demo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Source Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Disc className="w-5 h-5 text-indigo-400" />
            Select or Upload Audio Track
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload your song, paste a direct audio link, or search curated tracks to isolate vocals & cut snippets
          </p>
        </div>

        {/* Source Toggle Pills */}
        <div className="flex items-center p-1 bg-slate-950/70 rounded-xl border border-slate-800 shrink-0">
          <button
            id="input-tab-upload"
            onClick={() => setActiveInputTab('upload')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeInputTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>

          <button
            id="input-tab-link"
            onClick={() => setActiveInputTab('link')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeInputTab === 'link'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Audio Link
          </button>

          <button
            id="input-tab-search"
            onClick={() => setActiveInputTab('search')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeInputTab === 'search'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Search Library
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab 1: File Upload */}
      {activeInputTab === 'upload' && (
        <div className="mt-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-slate-700/80 hover:border-indigo-400/60 bg-slate-950/40 hover:bg-slate-950/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
              {isLoading ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : (
                <Upload className="w-7 h-7" />
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-200">
                {isLoading ? 'Decoding and analyzing audio stems...' : 'Drop your song here, or click to browse'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports MP3, WAV, FLAC, M4A, AAC, and OGG up to 100MB
              </p>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono">
                Lossless 32-bit Float DSP
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/40 text-indigo-300">
                Instant Instrumental & Vocal Stems
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Audio Link URL */}
      {activeInputTab === 'link' && (
        <form onSubmit={handleFetchUrl} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Paste Direct Audio URL
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  placeholder="https://example.com/audio/song.mp3"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !linkUrl.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 shadow-lg shadow-indigo-600/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    Load Track
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Works with direct MP3, WAV, and audio streams. The server securely proxies the link to bypass browser CORS limitations.
            </p>
          </div>
        </form>
      )}

      {/* Tab 3: Search Royalty-Free Song Library */}
      {activeInputTab === 'search' && (
        <div className="mt-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by song name, genre (Synthwave, Pop, Lo-Fi), or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
            {filteredLibrary.map((item) => {
              const isSelected = activeTrackId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleLoadCuratedTrack(item)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-950/40 shadow-sm'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/70'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                        {item.title}
                      </h4>
                      {isSelected && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {item.artist} • {item.genre} • {item.bpm} BPM
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                      {item.description}
                    </p>
                  </div>

                  <button
                    disabled={isLoading}
                    className="w-8 h-8 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white flex items-center justify-center shrink-0 transition-colors"
                  >
                    <Play className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              );
            })}

            {filteredLibrary.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-slate-500">
                No tracks found matching "{searchQuery}". Try searching for "Pop", "Synthwave", or "Lo-Fi".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Demo Pickers at bottom */}
      <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Instant Demo Tracks:
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {CURATED_LIBRARY.slice(0, 3).map((item) => (
            <button
              key={item.id}
              onClick={() => handleLoadCuratedTrack(item)}
              disabled={isLoading}
              className="text-[11px] px-3 py-1 rounded-full bg-slate-800/70 hover:bg-slate-700 border border-slate-700/60 text-slate-300 transition-colors flex items-center gap-1.5"
            >
              <Play className="w-2.5 h-2.5 text-indigo-400" />
              {item.title.split(' ')[0]} ({item.genre.split(' ')[0]})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
