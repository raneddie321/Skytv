import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusManager } from '@/navigation/FocusManager';

/** Builds a button with a fixed layout rect (jsdom has no layout). */
function el(left: number, top: number, width = 100, height = 50) {
  const b = document.createElement('button');
  b.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(b);
  return b;
}

function setup() {
  const m = new FocusManager();
  m.smoothScroll = false;
  const reg = (id: string, sectionId: string | null, x: number, y: number, handlers: { onSelect?: () => void } = {}) =>
    m.register({ id, el: el(x, y), sectionId, layerId: 'root', getHandlers: () => handlers });
  return { m, reg };
}

describe('FocusManager', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('moves within a row and between rows', () => {
    const { m, reg } = setup();
    m.registerSection({ id: 'row1', layerId: 'root' });
    m.registerSection({ id: 'row2', layerId: 'root' });
    ['a', 'b', 'c'].forEach((id, i) => reg(`r1:${id}`, 'row1', i * 120, 0));
    ['a', 'b', 'c'].forEach((id, i) => reg(`r2:${id}`, 'row2', i * 120, 100));
    m.focus('r1:a');
    m.move('right');
    expect(m.currentId).toBe('r1:b');
    m.move('down');
    expect(m.currentId).toBe('r2:b');
    expect(document.activeElement?.getAttribute('data-focused')).toBe('true');
  });

  it('restores the last focused item when re-entering a row', () => {
    const { m, reg } = setup();
    m.registerSection({ id: 'row1', layerId: 'root' });
    m.registerSection({ id: 'row2', layerId: 'root' });
    ['a', 'b', 'c'].forEach((id, i) => reg(`r1:${id}`, 'row1', i * 120, 0));
    ['a', 'b', 'c'].forEach((id, i) => reg(`r2:${id}`, 'row2', i * 120, 100));
    m.focus('r1:c');
    m.move('down'); // r2:c
    m.move('left'); // r2:b
    m.move('left'); // r2:a
    m.move('up'); // geometry says r1:a, memory says r1:c
    expect(m.currentId).toBe('r1:c');
  });

  it('returns focus from the nav bar to where the user came from', () => {
    const { m, reg } = setup();
    m.registerSection({ id: 'nav', layerId: 'root', returnFocus: true, block: ['up'] });
    m.registerSection({ id: 'row', layerId: 'root' });
    reg('nav:home', 'nav', 0, 0);
    reg('nav:movies', 'nav', 300, 0);
    ['a', 'b', 'c', 'd'].forEach((id, i) => reg(`row:${id}`, 'row', i * 120, 200));
    m.focus('row:d');
    m.move('up');
    expect(m.currentId).toBe('nav:movies');
    m.move('left');
    expect(m.currentId).toBe('nav:home');
    m.move('down');
    expect(m.currentId).toBe('row:d');
    m.focus('nav:home');
    expect(m.move('up')).toBe(false);
  });

  it('keeps focus inside the top layer and restores it when the layer closes', () => {
    const { m, reg } = setup();
    reg('page:btn', null, 0, 0);
    m.focus('page:btn');
    m.pushLayer('dialog');
    m.register({ id: 'dlg:ok', el: el(0, 300), sectionId: null, layerId: 'dialog', getHandlers: () => ({}) });
    m.register({ id: 'dlg:cancel', el: el(150, 300), sectionId: null, layerId: 'dialog', getHandlers: () => ({}) });
    expect(m.focus('page:btn')).toBe(false); // not reachable behind the dialog
    m.focus('dlg:ok');
    m.move('up');
    expect(m.currentId).toBe('dlg:ok'); // no escape upwards to the page
    m.move('right');
    expect(m.currentId).toBe('dlg:cancel');
    m.popLayer('dialog');
    expect(m.currentId).toBe('page:btn');
  });

  it('dispatches Enter to onSelect and Back through the handler stack', () => {
    const { m, reg } = setup();
    const onSelect = vi.fn();
    reg('x', null, 0, 0, { onSelect });
    m.focus('x');
    m.dispatch({ action: 'enter' });
    expect(onSelect).toHaveBeenCalledOnce();

    const fallback = vi.fn();
    m.defaultBack = fallback;
    const inner = vi.fn(() => true);
    const off = m.addBackHandler(inner);
    m.dispatch({ action: 'back' });
    expect(inner).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
    off();
    m.dispatch({ action: 'back' });
    expect(fallback).toHaveBeenCalledOnce();
  });

  it('lets action listeners consume keys before navigation', () => {
    const { m, reg } = setup();
    reg('a', null, 0, 0);
    reg('b', null, 120, 0);
    m.focus('a');
    const off = m.addActionListener((e) => e.action === 'right');
    m.dispatch({ action: 'right' });
    expect(m.currentId).toBe('a');
    off();
    m.dispatch({ action: 'right' });
    expect(m.currentId).toBe('b');
  });

  it('focuses a pending id as soon as it registers (async content)', async () => {
    const { m, reg } = setup();
    m.requestFocus('late');
    expect(m.currentId).toBeNull();
    reg('late', null, 0, 0);
    await Promise.resolve();
    expect(m.currentId).toBe('late');
  });

  it('recovers focus when the focused element is removed', async () => {
    const { m, reg } = setup();
    m.registerSection({ id: 'row', layerId: 'root' });
    reg('a', 'row', 0, 0);
    const offB = reg('b', 'row', 120, 0);
    reg('c', 'row', 240, 0);
    m.focus('b');
    offB();
    await new Promise((r) => setTimeout(r, 5));
    expect(['a', 'c']).toContain(m.currentId);
  });

  it('remembers focus per screen', () => {
    const { m, reg } = setup();
    reg('one', null, 0, 0);
    reg('two', null, 120, 0);
    m.setScreen('home');
    m.focus('two');
    expect(m.rememberedFor('home')).toBe('two');
  });
});
