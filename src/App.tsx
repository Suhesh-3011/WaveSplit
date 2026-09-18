import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AudioInputSection } from './components/AudioInputSection';
import { VocalIsolator } from './components/VocalIsolator';
import { SnippetCutter } from './components/SnippetCutter';
import { CoverArtGenerator } from './components/CoverArtGenerator';
import { GeminiChatbot } from './components/GeminiChatbot';
import { AudioTrack } from './types';
import { createSyntheticDemoTrack, extractPeaks } from './utils/audioProcessing';
import { CURATED_LIBRARY } from './utils/demoTracks';
import { Sliders, Scissors, Sparkles, MessageSquare, Music, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'isolator' | 'cutter' | 'art' | 'chat'>('isolator');
  const [activeTrack, setActiveTrack] = useState<AudioTrack | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Cross-component handoff: passing an isolated stem into the snippet cutter
  const [cutterBufferOverride, setCutterBufferOverride] = useState<AudioBuffer | null>(null);
  const [cutterStemLabel, setCutterStemLabel] = useState<string>('Original Track');

  // Auto-load the first curated demo track on initial mount so the user has immediate audio ready to play and isolate!
  useEffect(() => {
    try {
      const demo = CURATED_LIBRARY[0];
      const audioBuffer = createSyntheticDemoTrack(demo.generatorType);
      const peaks = extractPeaks(audioBuffer, 160);
      setActiveTrack({
        id: demo.id,
        title: demo.title,
        artist: demo.artist,
        duration: audioBuffer.duration,
        audioBuffer,
        sourceType: 'demo',
        peaks,
      });
    } catch (err) {
      console.error('Failed to initialize demo track:', err);
    }
  }, []);

  const handleTrackLoaded = (newTrack: AudioTrack) => {
    setActiveTrack(newTrack);
    setCutterBufferOverride(null);
    setCutterStemLabel('Original Track');
  };

  const handleSendToCutter = (processedBuffer: AudioBuffer, modeName: string) => {
    setCutterBufferOverride(processedBuffer);
    setCutterStemLabel(modeName);
    setActiveTab('cutter');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeTrackTitle={activeTrack?.title}
        hasTrack={!!activeTrack}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Audio Input Bar (Upload, Link, or Search) */}
        <AudioInputSection
          onTrackLoaded={handleTrackLoaded}
          isLoading={isLoadingAudio}
          setIsLoading={setIsLoadingAudio}
          activeTrackId={activeTrack?.id}
        />

        {/* Tab 1: Vocal Remover & Instrumental Extractor */}
        {activeTab === 'isolator' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {activeTrack ? (
              <VocalIsolator
                track={activeTrack}
                onSendToCutter={handleSendToCutter}
              />
            ) : (
              <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
                <Music className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-300">No Song Loaded</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Upload an audio file, paste a direct audio link, or choose a track from the library above to isolate vocals.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Ringtone & Social Snippet Cutter */}
        {activeTab === 'cutter' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {activeTrack ? (
              <SnippetCutter
                track={activeTrack}
                activeBufferOverride={cutterBufferOverride}
                stemSourceLabel={cutterStemLabel}
              />
            ) : (
              <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
                <Scissors className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-300">No Song Loaded</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Upload an audio file, paste a link, or pick a track above to cut custom ringtones and snippets.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Cover Art Studio (gemini-3-pro-image-preview with 1K, 2K, 4K) */}
        {activeTab === 'art' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <CoverArtGenerator track={activeTrack} />
          </div>
        )}

        {/* Tab 4: AI Producer & Mastering Chatbot */}
        {activeTab === 'chat' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <GeminiChatbot currentTrack={activeTrack} />
          </div>
        )}
      </main>

      {/* Persistent Footer with DSP Status */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/80 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Client-Side Lossless DSP</span>
            </div>
            <span>•</span>
            <span>Center Channel Mid/Side Subtraction</span>
            <span>•</span>
            <span>16-bit 44.1kHz Stereo WAV Export</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400 font-medium">Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
