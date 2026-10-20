/**
 * Normalises keyboard / remote-control events from browsers, Android TV WebViews, Samsung Tizen and LG webOS
 * into a small set of semantic actions. See docs/TV_REMOTE_MAPPING.md.
 */
export type TvAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'enter'
  | 'back'
  | 'playPause'
  | 'play'
  | 'pause'
  | 'stop'
  | 'rewind'
  | 'fastForward'
  | 'next'
  | 'previous'
  | 'channelUp'
  | 'channelDown'
  | 'info'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue';

export type Platform = 'browser' | 'androidtv' | 'tizen' | 'webos';

export interface ActionEvent {
  action: TvAction | null;
  /** Digit 0-9 when a number key was pressed. */
  digit?: number;
  /** Printable character (used by search/name entry when a physical keyboard is attached). */
  char?: string;
  backspace?: boolean;
}

/** key (KeyboardEvent.key) → action. Shared by all platforms that report standard key names. */
const KEY_NAMES: Record<string, TvAction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
  Enter: 'enter',
  Accept: 'enter',
  Select: 'enter',
  Escape: 'back',
  Esc: 'back',
  GoBack: 'back',
  BrowserBack: 'back',
  XF86Back: 'back',
  MediaPlayPause: 'playPause',
  MediaPlay: 'play',
  MediaPause: 'pause',
  MediaStop: 'stop',
  MediaRewind: 'rewind',
  MediaFastForward: 'fastForward',
  MediaTrackNext: 'next',
  MediaTrackPrevious: 'previous',
  ChannelUp: 'channelUp',
  ChannelDown: 'channelDown',
  PageUp: 'channelUp',
  PageDown: 'channelDown',
  Info: 'info',
  ColorF0Red: 'red',
  ColorF1Green: 'green',
  ColorF2Yellow: 'yellow',
  ColorF3Blue: 'blue',
  ' ': 'playPause',
};

/** keyCode fallbacks for older TV engines that report `Unidentified` keys. */
const KEY_CODES: Record<Platform, Record<number, TvAction>> = {
  browser: { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 27: 'back', 179: 'playPause', 178: 'stop', 176: 'next', 177: 'previous' },
  // Android TV WebView: DPAD maps to arrows (37-40), DPAD_CENTER to 13. KEYCODE_BACK is delivered to the Activity;
  // the native wrapper forwards it as a 'tvback' DOM event (see docs/PLATFORM_PACKAGING.md). Media keys use Chromium codes.
  androidtv: { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 23: 'enter', 4: 'back', 27: 'back', 179: 'playPause', 85: 'playPause', 126: 'play', 127: 'pause', 86: 'stop', 89: 'rewind', 90: 'fastForward', 166: 'channelUp', 167: 'channelDown' },
  tizen: { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 10009: 'back', 10252: 'playPause', 415: 'play', 19: 'pause', 413: 'stop', 412: 'rewind', 417: 'fastForward', 427: 'channelUp', 428: 'channelDown', 457: 'info', 403: 'red', 404: 'green', 405: 'yellow', 406: 'blue' },
  webos: { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 461: 'back', 415: 'play', 19: 'pause', 413: 'stop', 412: 'rewind', 417: 'fastForward', 33: 'channelUp', 34: 'channelDown', 457: 'info', 403: 'red', 404: 'green', 405: 'yellow', 406: 'blue' },
};

export function detectPlatform(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): Platform {
  if (/Tizen/i.test(userAgent)) return 'tizen';
  if (/Web0S|webOS|NetCast/i.test(userAgent)) return 'webos';
  if (/Android/i.test(userAgent) && /(TV|AFT|BRAVIA|SHIELD|Chromecast|GoogleTV)/i.test(userAgent)) return 'androidtv';
  return 'browser';
}

export interface KeyLike {
  key?: string;
  keyCode?: number;
  which?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export function mapKeyEvent(e: KeyLike, platform: Platform = 'browser'): ActionEvent {
  if (e.ctrlKey || e.metaKey || e.altKey) return { action: null };
  const key = e.key ?? '';
  if (key === 'Backspace') return { action: null, backspace: true };
  if (/^[0-9]$/.test(key)) return { action: null, digit: Number(key), char: key };
  const named = KEY_NAMES[key];
  if (named) return { action: named, char: key === ' ' ? ' ' : undefined };
  if (key.length === 1) return { action: null, char: key };
  const code = e.keyCode ?? e.which ?? 0;
  if (code >= 48 && code <= 57) return { action: null, digit: code - 48, char: String(code - 48) };
  return { action: KEY_CODES[platform][code] ?? KEY_CODES.browser[code] ?? null };
}

/**
 * Platform-specific registration of remote keys. Tizen only delivers media/colour keys once registered;
 * webOS and Android TV deliver them by default.
 */
export function registerPlatformKeys(platform: Platform): void {
  if (platform !== 'tizen') return;
  const w = window as unknown as { tizen?: { tvinputdevice?: { registerKeyBatch?: (keys: string[]) => void; registerKey?: (k: string) => void } } };
  const keys = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward', 'ChannelUp', 'ChannelDown', 'Info', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  try {
    const dev = w.tizen?.tvinputdevice;
    if (dev?.registerKeyBatch) dev.registerKeyBatch(keys);
    else keys.forEach((k) => dev?.registerKey?.(k));
  } catch {
    /* not running on a Tizen device */
  }
}
