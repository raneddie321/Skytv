import { describe, expect, it } from 'vitest';
import type { StreamSource } from '@/api/contracts/domain';
import { playMethodFor, rankSources, type Capabilities } from '@/player/engine';

const hls: StreamSource = { url: '/a.m3u8', protocol: 'hls', mimeType: 'application/vnd.apple.mpegurl', codecs: 'avc1.4d401f,mp4a.40.2' };
const webm: StreamSource = { url: '/a.webm', protocol: 'progressive', mimeType: 'video/webm', codecs: 'vp9,opus' };
const dash: StreamSource = { url: '/a.mpd', protocol: 'dash', mimeType: 'application/dash+xml' };

const caps = (c: Partial<Capabilities>): Capabilities => ({ nativeHls: false, mse: false, mseSupports: () => false, canPlay: () => false, ...c });

describe('player source selection', () => {
  it('uses native HLS when the platform supports it (Safari, Tizen, webOS)', () => {
    expect(playMethodFor(hls, caps({ nativeHls: true }))).toBe('native-hls');
  });

  it('uses hls.js only when MSE supports the declared codecs', () => {
    expect(playMethodFor(hls, caps({ mse: true, mseSupports: (t) => t.includes('avc1') }))).toBe('hlsjs');
    expect(playMethodFor(hls, caps({ mse: true, mseSupports: () => false }))).toBeNull();
  });

  it('falls back to progressive playback and skips unsupported formats', () => {
    const ranked = rankSources([hls, dash, webm], caps({ canPlay: (t) => t.startsWith('video/webm') }));
    expect(ranked.map((r) => r.source.url)).toEqual(['/a.webm']);
  });

  it('honours the stream preference', () => {
    const c = caps({ nativeHls: true, canPlay: () => true });
    expect(rankSources([hls, webm], c, 'progressive')[0].source).toBe(webm);
    expect(rankSources([webm, hls], c, 'hls')[0].source).toBe(hls);
    expect(rankSources([webm, hls], c, 'auto')[0].source).toBe(webm);
  });

  it('refuses DRM sources until a DRM integration exists', () => {
    expect(playMethodFor({ ...hls, drm: { system: 'widevine', licenseUrl: 'x' } }, caps({ nativeHls: true }))).toBeNull();
  });
});
