import React, { useState } from 'react';
import { Sparkles, Download, Image as ImageIcon, Loader2, Wand2, Check, AlertCircle } from 'lucide-react';
import { ImageResolution, ImageAspectRatio, AudioTrack } from '../types';

interface CoverArtGeneratorProps {
  track?: AudioTrack | null;
  onSetArtworkUrl?: (url: string) => void;
}

const INSPIRATION_PROMPTS = [
  'A neon-lit cyberpunk synthesizer cassette tape floating in retro digital space, highly detailed 3D render',
  'A warm golden hour sunset reflecting over ocean waves with minimalist acoustic guitar outline, cinematic lighting',
  'A cozy midnight rain coffeehouse lo-fi aesthetic vinyl record spinning on a wooden desk, warm glow',
  'A luxury minimalist black and gold geometric audio wave icon for modern smartphone ringtones, sleek studio lighting',
  'A vibrant EDM festival crowd with purple laser beams and floating holographic sound waves, energetic atmosphere',
];

export const CoverArtGenerator: React.FC<CoverArtGeneratorProps> = ({
  track,
  onSetArtworkUrl,
}) => {
  const [prompt, setPrompt] = useState(
    track
      ? `Album cover art for the track "${track.title}" by ${track.artist}, stylish music visual aesthetic`
      : 'Vibrant album cover art with holographic neon audio waves and modern typography style'
  );
  const [imageSize, setImageSize] = useState<ImageResolution>('2K');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          imageSize, // '1K', '2K', or '4K'
          aspectRatio, // '1:1', '16:9', etc.
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Generation failed with status ${response.status}`);
      }

      setGeneratedImageUrl(data.imageUrl);
      if (onSetArtworkUrl) {
        onSetArtworkUrl(data.imageUrl);
      }
    } catch (err: any) {
      console.error('Image gen error:', err);
      setError(err.message || 'Failed to generate cover art. Please verify your GEMINI_API_KEY.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    if (!generatedImageUrl) return;
    const a = document.createElement('a');
    a.href = generatedImageUrl;
    const trackSlug = track?.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Artwork';
    a.download = `${trackSlug}_CoverArt_${imageSize}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              High-Quality Image Generation
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              Model: gemini-3-pro-image-preview
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
            Studio Cover Art & Ringtone Icon Studio
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate high-resolution custom artwork for your instrumental tracks, ringtones, or social media snippets.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls (7 cols) */}
        <form onSubmit={handleGenerate} className="lg:col-span-7 space-y-5">
          {/* Prompt Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Art Prompt Description</span>
              <button
                type="button"
                onClick={() => {
                  const random = INSPIRATION_PROMPTS[Math.floor(Math.random() * INSPIRATION_PROMPTS.length)];
                  setPrompt(random);
                }}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-normal"
              >
                <Wand2 className="w-3 h-3" />
                Randomize Idea
              </button>
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the aesthetic, colors, instruments, lighting, and mood..."
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Inspiration Chips */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              Instant Inspiration Styles:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {INSPIRATION_PROMPTS.map((insp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(insp)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors text-left line-clamp-1 max-w-xs"
                >
                  "{insp.slice(0, 35)}..."
                </button>
              ))}
            </div>
          </div>

          {/* Controls: Resolution & Aspect Ratio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Affordance for User to Specify Image Size: 1K, 2K, 4K */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Image Resolution (Size)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['1K', '2K', '4K'] as ImageResolution[]).map((size) => {
                  const isSelected = imageSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      id={`size-${size}`}
                      onClick={() => setImageSize(size)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'border-slate-700/80 bg-slate-950/60 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Supports standard 1K, high-def 2K, and master 4K outputs.
              </p>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '1:1', label: '1:1 Square (Album)' },
                  { id: '16:9', label: '16:9 Wide (Video)' },
                  { id: '9:16', label: '9:16 Reel (Story)' },
                ].map((ar) => {
                  const isSelected = aspectRatio === ar.id;
                  return (
                    <button
                      key={ar.id}
                      type="button"
                      id={`aspect-${ar.id.replace(':', '-')}`}
                      onClick={() => setAspectRatio(ar.id as ImageAspectRatio)}
                      className={`py-2 px-1 rounded-xl text-xs font-semibold border text-center transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'border-slate-700/80 bg-slate-950/60 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {ar.id}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="btn-generate-artwork"
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:via-indigo-500 hover:to-pink-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Synthesizing {imageSize} Artwork with gemini-3-pro-image-preview...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate {imageSize} Cover Art
              </>
            )}
          </button>
        </form>

        {/* Right Column: Image Preview & Download (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800 min-h-[300px]">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-3">
              <span>Artwork Preview</span>
              {generatedImageUrl && (
                <span className="text-purple-400 font-mono text-[11px]">
                  {imageSize} • {aspectRatio}
                </span>
              )}
            </div>

            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 animate-pulse">
                    <Sparkles className="w-6 h-6 animate-spin" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      Creating high-resolution artwork...
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Targeting {imageSize} canvas resolution with gemini-3-pro-image-preview
                    </p>
                  </div>
                </div>
              ) : generatedImageUrl ? (
                <img
                  src={generatedImageUrl}
                  alt="Generated Cover Artwork"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-500 p-6 text-center">
                  <ImageIcon className="w-10 h-10 stroke-1" />
                  <p className="text-xs font-medium">No artwork generated yet</p>
                  <p className="text-[10px] text-slate-600 max-w-[200px]">
                    Choose your resolution (1K, 2K, or 4K) and click generate to create album art
                  </p>
                </div>
              )}
            </div>
          </div>

          {generatedImageUrl && (
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadImage}
                className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Download ({imageSize})
              </button>

              {onSetArtworkUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onSetArtworkUrl(generatedImageUrl);
                    setCopiedNotification(true);
                    setTimeout(() => setCopiedNotification(false), 2500);
                  }}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  {copiedNotification ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Applied!
                    </>
                  ) : (
                    'Attach to Track'
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
