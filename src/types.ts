export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  audioBuffer: AudioBuffer | null;
  audioBlob?: Blob;
  sourceType: 'upload' | 'url' | 'search' | 'demo' | 'record';
  originalUrl?: string;
  peaks: number[]; // normalized 0-1 for waveform display
}

export type PlaybackMode = 'original' | 'instrumental' | 'vocal' | 'custom';

export interface StemSettings {
  instrumentalVolume: number; // 0 to 1
  vocalVolume: number; // 0 to 1
  vocalRemovalDepth: number; // 0.1 to 1.0 (phase cancellation strength)
  bassPreserve: boolean; // keep < 180Hz center intact
  highPreserve: boolean; // keep > 8kHz stereo intact
  mode: PlaybackMode;
}

export interface SnippetSettings {
  startTime: number; // seconds
  endTime: number; // seconds
  fadeInDuration: number; // seconds (0 to 3)
  fadeOutDuration: number; // seconds (0 to 3)
  isLooping: boolean;
  presetName?: string;
}

export type SnippetPresetType = 'ringtone' | 'notification' | 'tiktok' | 'reels' | 'teaser' | 'custom';

export interface SnippetPreset {
  id: SnippetPresetType;
  label: string;
  duration: number; // seconds
  icon: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export type GeminiChatModel = 'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite';

export type ImageResolution = '1K' | '2K' | '4K';
export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
