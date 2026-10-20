import { describe, expect, it } from 'vitest';
import { detectPlatform, mapKeyEvent } from '@/navigation/keymap';

describe('remote key mapping', () => {
  it('maps standard browser keys', () => {
    expect(mapKeyEvent({ key: 'ArrowUp' }).action).toBe('up');
    expect(mapKeyEvent({ key: 'Enter' }).action).toBe('enter');
    expect(mapKeyEvent({ key: 'Escape' }).action).toBe('back');
    expect(mapKeyEvent({ key: 'MediaPlayPause' }).action).toBe('playPause');
    expect(mapKeyEvent({ key: 'MediaStop' }).action).toBe('stop');
    expect(mapKeyEvent({ key: 'Backspace' }).backspace).toBe(true);
  });

  it('maps digits and printable characters', () => {
    expect(mapKeyEvent({ key: '7' })).toMatchObject({ digit: 7, char: '7' });
    expect(mapKeyEvent({ key: 'a' })).toMatchObject({ action: null, char: 'a' });
  });

  it('maps Samsung Tizen key codes', () => {
    expect(mapKeyEvent({ key: 'Unidentified', keyCode: 10009 }, 'tizen').action).toBe('back');
    expect(mapKeyEvent({ key: 'Unidentified', keyCode: 10252 }, 'tizen').action).toBe('playPause');
    expect(mapKeyEvent({ key: 'Unidentified', keyCode: 413 }, 'tizen').action).toBe('stop');
    expect(mapKeyEvent({ key: 'Unidentified', keyCode: 427 }, 'tizen').action).toBe('channelUp');
  });

  it('maps LG webOS key codes', () => {
    expect(mapKeyEvent({ key: 'Unidentified', keyCode: 461 }, 'webos').action).toBe('back');
    expect(mapKeyEvent({ key: 'Unidentified', keyCode: 415 }, 'webos').action).toBe('play');
    expect(mapKeyEvent({ key: 'Unidentified', keyCode: 19 }, 'webos').action).toBe('pause');
  });

  it('maps Android TV key codes', () => {
    expect(mapKeyEvent({ key: 'Unidentified', keyCode: 23 }, 'androidtv').action).toBe('enter');
    expect(mapKeyEvent({ key: 'Unidentified', keyCode: 4 }, 'androidtv').action).toBe('back');
    expect(mapKeyEvent({ key: 'Unidentified', keyCode: 85 }, 'androidtv').action).toBe('playPause');
  });

  it('ignores browser shortcuts with modifiers', () => {
    expect(mapKeyEvent({ key: 'ArrowLeft', altKey: true }).action).toBeNull();
  });

  it('detects TV platforms from the user agent', () => {
    expect(detectPlatform('Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36')).toBe('tizen');
    expect(detectPlatform('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36')).toBe('webos');
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 12; BRAVIA 4K VH2) AppleWebKit/537.36')).toBe('androidtv');
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64) Chrome/141')).toBe('browser');
  });
});
