export interface CuratedTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: string;
  approxSeconds: number;
  bpm: number;
  tags: string[];
  description: string;
  generatorType: 'synthwave' | 'pop' | 'lofi';
  publicUrl?: string;
}

export const CURATED_LIBRARY: CuratedTrack[] = [
  {
    id: 'demo-synthwave',
    title: 'Neon Skyline (Lead Vocal Mix)',
    artist: 'Antigravity Soundworks',
    genre: 'Synthwave / Retro Electro',
    duration: '00:28',
    approxSeconds: 28,
    bpm: 120,
    tags: ['synthwave', 'retrowave', 'retro', 'electronic', 'lead vocal', '80s'],
    description: 'Punchy 80s drums, lush stereo synthesizers, and centered vocoder lead melodies ready for instrumental extraction.',
    generatorType: 'synthwave',
  },
  {
    id: 'demo-pop',
    title: 'Golden Sunset Serenade',
    artist: 'Aura Collective',
    genre: 'Modern Pop',
    duration: '00:28',
    approxSeconds: 28,
    bpm: 126,
    tags: ['pop', 'acoustic', 'melody', 'hook', 'summer', 'commercial'],
    description: 'Upbeat melodic chorus with centered human vocal lines, ideal for 15s TikTok snippets and 30s phone ringtones.',
    generatorType: 'pop',
  },
  {
    id: 'demo-lofi',
    title: 'Midnight Rain Coffeehouse',
    artist: 'Chillout Lounge',
    genre: 'Lo-Fi Chillhop',
    duration: '00:28',
    approxSeconds: 28,
    bpm: 84,
    tags: ['lofi', 'chill', 'relax', 'study', 'soft vocal', 'beat'],
    description: 'Mellow Rhodes chords, vinyl warmth, and soulful centered vocal hooks. Perfect for peaceful ringtones.',
    generatorType: 'lofi',
  },
  {
    id: 'sample-freemusic-1',
    title: 'Cyberpulse Horizons',
    artist: 'Studio Stems',
    genre: 'Cyberpunk EDM',
    duration: '00:28',
    approxSeconds: 28,
    bpm: 128,
    tags: ['cyberpunk', 'edm', 'club', 'dance', 'drop'],
    description: 'Driving bass drop and soaring vocal leads. Great for energetic social media hooks and alert ringtones.',
    generatorType: 'synthwave',
  },
];
