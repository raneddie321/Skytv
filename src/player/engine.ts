/**
 * Playback engine: picks the best playable source for the device and attaches it to an HTMLVideoElement.
 *  - HLS: native (Safari, Tizen, webOS) or hls.js over Media Source Extensions (Chromium, Android TV WebView).
 *  - Progressive (MP4/WebM): native <video>.
 *  - DASH/DRM: not implemented; the StreamSource contract carries the data needed to add Shaka Player or a
 *    platform SDK (AVPlay on Tizen, Luna media pipeline on webOS, ExoPlayer on Android TV).
 * Sources are tried in order; a source that fails before metadata loads falls through to the next one.
 */
import type { StreamSource } from '@/api/contracts/domain';

export interface Capabilities {
  nativeHls: boolean;
  mse: boolean;
  mseSupports: (type: string) => boolean;
  canPlay: (type: string) => boolean;
}

export type PreferredStream = 'auto' | 'hls' | 'progressive';

export function detectCapabilities(video: HTMLVideoElement): Capabilities {
  const MS = (window as unknown as { MediaSource?: typeof MediaSource; ManagedMediaSource?: typeof MediaSource }).MediaSource ??
    (window as unknown as { ManagedMediaSource?: typeof MediaSource }).ManagedMediaSource;
  return {
    nativeHls: !!video.canPlayType('application/vnd.apple.mpegurl'),
    mse: !!MS,
    mseSupports: (type) => {
      try {
        return !!MS?.isTypeSupported(type);
      } catch {
        return false;
      }
    },
    canPlay: (type) => !!video.canPlayType(type),
  };
}

export type PlayMethod = 'native-hls' | 'hlsjs' | 'progressive';

export function playMethodFor(source: StreamSource, caps: Capabilities): PlayMethod | null {
  if (source.drm) return null; // requires an EME/DRM integration (see docs/PLATFORM_PACKAGING.md)
  if (source.protocol === 'hls') {
    if (caps.nativeHls) return 'native-hls';
    const codecs = source.codecs ? `; codecs="${source.codecs}"` : '';
    if (caps.mse && caps.mseSupports(`video/mp4${codecs}`)) return 'hlsjs';
    return null;
  }
  if (source.protocol === 'progressive') {
    const codecs = source.codecs ? `; codecs="${source.codecs}"` : '';
    return caps.canPlay(`${source.mimeType}${codecs}`) ? 'progressive' : null;
  }
  return null;
}

/** Orders sources by preference and drops those the device cannot play. */
export function rankSources(sources: StreamSource[], caps: Capabilities, preferred: PreferredStream = 'auto') {
  const ordered = [...sources].sort((a, b) => {
    if (preferred === 'auto') return 0;
    const want = preferred === 'hls' ? 'hls' : 'progressive';
    return Number(b.protocol === want) - Number(a.protocol === want);
  });
  return ordered
    .map((source) => ({ source, method: playMethodFor(source, caps) }))
    .filter((x): x is { source: StreamSource; method: PlayMethod } => !!x.method);
}

interface HlsLike {
  loadSource(url: string): void;
  attachMedia(el: HTMLMediaElement): void;
  recoverMediaError(): void;
  destroy(): void;
  on(event: string, cb: (event: string, data: { fatal?: boolean; type?: string; details?: string }) => void): void;
}

export class PlayerEngine {
  private hls: HlsLike | null = null;
  private disposed = false;
  current: { source: StreamSource; method: PlayMethod } | null = null;

  constructor(private readonly video: HTMLVideoElement) {}

  async load(sources: StreamSource[], preferred: PreferredStream = 'auto'): Promise<{ source: StreamSource; method: PlayMethod }> {
    const candidates = rankSources(sources, detectCapabilities(this.video), preferred);
    if (!candidates.length) throw new Error('No playable stream for this device');
    let lastError: unknown;
    for (const candidate of candidates) {
      if (this.disposed) break;
      try {
        await this.attach(candidate.source, candidate.method);
        this.current = candidate;
        return candidate;
      } catch (e) {
        lastError = e;
        this.teardown();
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Playback failed');
  }

  private attach(source: StreamSource, method: PlayMethod): Promise<void> {
    const video = this.video;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = (err?: unknown) => {
        if (settled) return;
        settled = true;
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('error', onError);
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      };
      const onMeta = () => done();
      const onError = () => done(new Error(`Media error ${video.error?.code ?? ''}`));
      const timer = setTimeout(() => done(new Error('Timed out loading stream')), 15_000);
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('error', onError);

      if (method === 'hlsjs') {
        import('hls.js')
          .then(({ default: Hls }) => {
            if (this.disposed) return done(new Error('disposed'));
            if (!Hls.isSupported()) return done(new Error('hls.js not supported'));
            // Conservative buffers for low-memory TV hardware.
            const hls = new Hls({ maxBufferLength: 20, maxMaxBufferLength: 40, backBufferLength: 15, enableWorker: true }) as unknown as HlsLike;
            this.hls = hls;
            let recovered = false;
            hls.on(Hls.Events.ERROR, (_e, data) => {
              if (!data.fatal) return;
              if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
                recovered = true;
                hls.recoverMediaError();
                return;
              }
              done(new Error(`HLS error: ${data.details}`));
            });
            hls.loadSource(source.url);
            hls.attachMedia(video);
          })
          .catch(done);
      } else {
        video.src = source.url;
        video.load();
      }
    });
  }

  private teardown() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.video.removeAttribute('src');
    try {
      this.video.load();
    } catch {
      /* ignore */
    }
  }

  destroy() {
    this.disposed = true;
    this.teardown();
  }
}
