/**
 * Audio Processing Utility
 * Provides Web Audio API decoding, Mid/Side phase cancellation DSP for vocal isolation/removal,
 * snippet cutting with fades, waveform peak analysis, and 16-bit PCM WAV encoding.
 */

let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

/**
 * Decode audio ArrayBuffer into an AudioBuffer
 */
export async function decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  // slice buffer to prevent detach issues in some browser implementations
  const bufferCopy = arrayBuffer.slice(0);
  return await ctx.decodeAudioData(bufferCopy);
}

/**
 * Extract peaks for waveform visualization (e.g. 150 points)
 */
export function extractPeaks(audioBuffer: AudioBuffer, numPoints = 150): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const step = Math.floor(channelData.length / numPoints);
  const peaks: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const start = i * step;
    const end = Math.min(start + step, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  // Normalize between 0.05 and 1.0 for aesthetic display
  const highest = Math.max(...peaks, 0.001);
  return peaks.map((p) => Math.max(0.08, p / highest));
}

/**
 * Process AudioBuffer into an Instrumental track (Center Channel Subtraction with Bass Preservation)
 * or Isolated Vocal track.
 */
export async function processStemsOffline(
  sourceBuffer: AudioBuffer,
  options: {
    mode: 'instrumental' | 'vocal' | 'custom';
    instrumentalLevel: number; // 0 to 1
    vocalLevel: number; // 0 to 1
    vocalRemovalDepth: number; // 0.1 to 1.0
    preserveBass: boolean;
    preserveHighs: boolean;
  }
): Promise<AudioBuffer> {
  const numChannels = sourceBuffer.numberOfChannels;
  const sampleRate = sourceBuffer.sampleRate;
  const length = sourceBuffer.length;

  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
  const outBuffer = offlineCtx.createBuffer(2, length, sampleRate);

  const leftIn = sourceBuffer.getChannelData(0);
  const rightIn = numChannels > 1 ? sourceBuffer.getChannelData(1) : sourceBuffer.getChannelData(0);

  const leftOut = outBuffer.getChannelData(0);
  const rightOut = outBuffer.getChannelData(1);

  // If source is purely mono, simulate stereo spread so vocal cancellation DSP has spatial differential
  const depth = options.vocalRemovalDepth;
  const isInstrumental = options.mode === 'instrumental';
  const isVocal = options.mode === 'vocal';

  // Simple biquad-like IIR lowpass filter state for bass crossover (~180Hz)
  // rc = 1 / (2 * pi * f0)
  const f0Bass = 180;
  const dt = 1 / sampleRate;
  const rcBass = 1 / (2 * Math.PI * f0Bass);
  const alphaBass = dt / (rcBass + dt);

  // Highpass filter state for highs preservation (~8000Hz)
  const f0High = 8000;
  const rcHigh = 1 / (2 * Math.PI * f0High);
  const alphaHigh = rcHigh / (rcHigh + dt);

  let bassL = 0;
  let bassR = 0;
  let prevInL = 0;
  let prevInR = 0;
  let highL = 0;
  let highR = 0;

  for (let i = 0; i < length; i++) {
    const l = leftIn[i];
    const r = rightIn[i];

    // Compute bass crossover
    bassL += alphaBass * (l - bassL);
    bassR += alphaBass * (r - bassR);
    const monoBass = (bassL + bassR) * 0.5;

    // Compute highpass crossover
    highL = alphaHigh * (highL + l - prevInL);
    highR = alphaHigh * (highR + r - prevInR);
    prevInL = l;
    prevInR = r;

    // Mid (Center = L + R) and Side (Stereo = L - R)
    const mid = (l + r) * 0.5;
    const side = (l - r) * 0.5;

    // Vocal cancellation signal:
    // Left = Side + Bass (preserves bass) + Highs
    // Right = -Side + Bass + Highs
    let instL = (l - r * depth * 0.95);
    let instR = (r - l * depth * 0.95);

    if (options.preserveBass) {
      instL = instL * 0.75 + monoBass * 0.85;
      instR = instR * 0.75 + monoBass * 0.85;
    }
    if (options.preserveHighs) {
      instL += highL * 0.25;
      instR += highR * 0.25;
    }

    // Vocal isolation signal:
    // Center vocal = Mid - Side
    // Attenuate extreme lows and highs to focus on human vocal spectrum (200Hz - 4.5kHz)
    const vocalCore = (mid - Math.abs(side) * 0.6) * 1.4;
    const vocalL = (vocalCore - monoBass * 0.8);
    const vocalR = (vocalCore - monoBass * 0.8);

    if (isInstrumental) {
      leftOut[i] = Math.max(-1, Math.min(1, instL * options.instrumentalLevel));
      rightOut[i] = Math.max(-1, Math.min(1, instR * options.instrumentalLevel));
    } else if (isVocal) {
      leftOut[i] = Math.max(-1, Math.min(1, vocalL * options.vocalLevel));
      rightOut[i] = Math.max(-1, Math.min(1, vocalR * options.vocalLevel));
    } else {
      // Custom mix
      const mixedL = instL * options.instrumentalLevel + vocalL * options.vocalLevel;
      const mixedR = instR * options.instrumentalLevel + vocalR * options.vocalLevel;
      leftOut[i] = Math.max(-1, Math.min(1, mixedL));
      rightOut[i] = Math.max(-1, Math.min(1, mixedR));
    }
  }

  return outBuffer;
}

/**
 * Cut an audio segment with optional Fade-in and Fade-out
 */
export async function cutAudioSegment(
  sourceBuffer: AudioBuffer,
  startTime: number,
  endTime: number,
  fadeInSec = 0.5,
  fadeOutSec = 0.5
): Promise<AudioBuffer> {
  const sampleRate = sourceBuffer.sampleRate;
  const numChannels = sourceBuffer.numberOfChannels;

  const startSample = Math.max(0, Math.floor(startTime * sampleRate));
  const endSample = Math.min(sourceBuffer.length, Math.floor(endTime * sampleRate));
  const newLength = Math.max(1, endSample - startSample);

  const ctx = getAudioContext();
  const trimmedBuffer = ctx.createBuffer(numChannels, newLength, sampleRate);

  const fadeInSamples = Math.floor(fadeInSec * sampleRate);
  const fadeOutSamples = Math.floor(fadeOutSec * sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const src = sourceBuffer.getChannelData(ch);
    const dst = trimmedBuffer.getChannelData(ch);

    for (let i = 0; i < newLength; i++) {
      let sample = src[startSample + i];

      // Apply Fade In
      if (fadeInSamples > 0 && i < fadeInSamples) {
        sample *= i / fadeInSamples;
      }

      // Apply Fade Out
      const fromEnd = newLength - 1 - i;
      if (fadeOutSamples > 0 && fromEnd < fadeOutSamples) {
        sample *= fromEnd / fadeOutSamples;
      }

      dst[i] = sample;
    }
  }

  return trimmedBuffer;
}

/**
 * Encode an AudioBuffer into standard 16-bit PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = buffer.length;
  const dataByteLength = numSamples * blockAlign;
  const headerByteLength = 44;
  const totalByteLength = headerByteLength + dataByteLength;

  const arrayBuffer = new ArrayBuffer(totalByteLength);
  const view = new DataView(arrayBuffer);

  // Helper to write ASCII strings
  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Interleave and quantize float32 samples to int16
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      // Clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Formats time in seconds to mm:ss.ms (e.g. 01:24.50)
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Synthesizes an interactive demo track (Dual Layer: Synth Chords + Center Lead Vocoder Vocal + Drums)
 * Perfect for immediate testing of vocal isolation & ringtone cutting right in the browser!
 */
export function createSyntheticDemoTrack(genre: 'synthwave' | 'pop' | 'lofi' = 'synthwave'): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const duration = 28; // 28 seconds preview
  const numSamples = Math.floor(duration * sampleRate);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const bpm = genre === 'synthwave' ? 120 : genre === 'lofi' ? 84 : 126;
  const beatDuration = 60 / bpm;

  // Chord progression (in Hz)
  const chords = [
    [220, 261.63, 329.63, 392.00], // Am7
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [196.00, 246.94, 293.66, 392.00], // G
  ];

  // Lead "Vocal" Melody notes (Hz) - panned dead center
  const vocalMelody = [
    523.25, 587.33, 659.25, 587.33, 523.25, 440.00, 493.88, 523.25,
    659.25, 783.99, 659.25, 587.33, 523.25, 659.25, 587.33, 523.25,
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beat = t / beatDuration;
    const bar = Math.floor(beat / 4);
    const chord = chords[bar % chords.length];

    // Stereo synth pads (panned wide L/R)
    let padL = 0;
    let padR = 0;
    for (let c = 0; c < chord.length; c++) {
      const freq = chord[c];
      const detune = 1.004;
      padL += Math.sin(2 * Math.PI * freq * t) * 0.05;
      padR += Math.sin(2 * Math.PI * (freq * detune) * t) * 0.05;
    }

    // Drum beat (Kick + Snare + Hi-hat)
    const beatFract = beat % 1;
    // Kick on beat 0 and 2
    let drum = 0;
    if (beat % 2 < 0.25) {
      const kickEnv = Math.max(0, 1 - (beatFract * 4));
      drum += Math.sin(2 * Math.PI * 65 * Math.exp(-beatFract * 12) * t) * kickEnv * 0.35;
    }
    // Snare on beat 1 and 3
    if ((beat + 1) % 2 < 0.25) {
      const snareEnv = Math.max(0, 1 - (beatFract * 4));
      const noise = (Math.random() * 2 - 1) * 0.15;
      drum += (Math.sin(2 * Math.PI * 180 * t) * 0.15 + noise) * snareEnv;
    }
    // Hi-hat every 0.5 beat
    if ((beat * 2) % 1 < 0.15) {
      drum += (Math.random() * 2 - 1) * 0.035;
    }

    // Lead VOCAL Track (dead center - identical in L and R)
    const melodyIndex = Math.floor(beat * 2) % vocalMelody.length;
    const vocalFreq = vocalMelody[melodyIndex];
    // Rich harmonic formant-like timbre
    const vocalEnv = Math.sin(Math.PI * Math.min(1, ((beat * 2) % 1) * 1.5));
    const vocal = (
      Math.sin(2 * Math.PI * vocalFreq * t) * 0.6 +
      Math.sin(2 * Math.PI * (vocalFreq * 2) * t) * 0.25 +
      Math.sin(2 * Math.PI * (vocalFreq * 3) * t) * 0.15
    ) * vocalEnv * 0.25;

    // Combine: Pad is stereo (different L & R), Drum is slightly stereo, Vocal is strictly dead center!
    left[i] = padL + drum * 0.8 + vocal;
    right[i] = padR + drum * 0.8 + vocal;
  }

  return buffer;
}
