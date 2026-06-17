/**
 * Troll Sound Utilities
 * Shared Web Audio API helper for reliable sound playback in troll events.
 * Uses AudioContext (not HTML5 Audio) to bypass browser autoplay restrictions.
 */

let _sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_sharedCtx) {
    _sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (_sharedCtx.state === 'suspended') {
    _sharedCtx.resume();
  }
  return _sharedCtx;
}

async function fetchAudioBuffer(url: string): Promise<AudioBuffer | null> {
  const ctx = getCtx();
  if (!ctx) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuf);
  } catch {
    return null;
  }
}

/**
 * Play a sound file via Web Audio API.
 * @param url     - Path to the audio file (e.g. '/sounds/troll.mp3')
 * @param volume  - 0.0 to 1.0
 */
export async function playSoundBuffer(url: string, volume = 0.7): Promise<void> {
  try {
    const ctx = getCtx();
    if (!ctx) return;

    const buffer = await fetchAudioBuffer(url);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = Math.min(volume, 1.0);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  } catch {
    // Silently ignore — sound is non-critical
  }
}
