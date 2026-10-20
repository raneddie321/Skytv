/**
 * Spatial focus manager for TV remote / keyboard navigation.
 *
 * Concepts
 *  - Focusable: an element registered with a stable id. Real DOM focus is used (tabIndex=-1) so screen readers and
 *    :focus styles work, and `data-focused="true"` is set for styling that must not depend on document focus.
 *  - Section: a group of focusables (a row, a grid, the nav bar). Remembers its last focused child so returning to a
 *    row restores the same card. Sections can block leaving in given directions and can "return focus" to where the
 *    user came from (used by the navigation bar).
 *  - Layer: modal stack (dialogs, keyboards, the player). Only the top layer's focusables are reachable, which prevents
 *    focus leaking behind overlays; focus is restored to the previous layer when a layer closes.
 *  - Screen memory: the last focused id per screen key, restored when navigating back.
 */
import { findBest, isInDirection, type Direction, type Rect } from './geometry';
import { detectPlatform, mapKeyEvent, type ActionEvent, type Platform } from './keymap';
import { ensureVisible } from './scroll';

export interface FocusableRegistration {
  id: string;
  el: HTMLElement;
  sectionId: string | null;
  layerId: string;
  getHandlers: () => { onSelect?: () => void; onFocus?: () => void; disabled?: boolean };
}

export interface SectionOptions {
  id: string;
  layerId: string;
  /** Where focus lands when entering the section from outside. Default: 'last' (falls back to nearest). */
  enterTo?: 'last' | 'first' | 'nearest' | 'default';
  defaultId?: () => string | undefined;
  /** Directions in which focus may not leave this section. */
  block?: Direction[];
  /** When leaving, return to the element focus came from (navigation bar behaviour). */
  returnFocus?: boolean;
  /** Persistent chrome (navigation bars): never stored as a screen's remembered focus. */
  excludeFromMemory?: boolean;
}

interface SectionState extends SectionOptions {
  lastFocusedId?: string;
  cameFromId?: string;
}

export type ActionListener = (event: ActionEvent & { repeat: boolean }) => boolean | void;
export type BackHandler = () => boolean | void;

interface Entry extends FocusableRegistration {
  seq: number;
}

const REPEAT_THROTTLE_MS = 70;

export class FocusManager {
  private entries = new Map<string, Entry>();
  private sections = new Map<string, SectionState>();
  private layers: string[] = ['root'];
  private layerReturn = new Map<string, string | null>();
  private listeners: ActionListener[] = [];
  private backHandlers: BackHandler[] = [];
  private subscribers = new Set<() => void>();
  private memory = new Map<string, string>();
  private screenKey: string | null = null;
  private pending: { id: string; timer: ReturnType<typeof setTimeout> } | null = null;
  private lastRect: Rect | null = null;
  private lastMoveAt = 0;
  private seq = 0;
  private recoverScheduled = false;
  currentId: string | null = null;
  platform: Platform = detectPlatform();
  smoothScroll = true;
  /** Fallback when no back handler consumes Back. */
  defaultBack: (() => void) | null = null;

  // ------------------------------------------------------------------ subscriptions
  subscribe = (fn: () => void) => {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  };
  private notify() {
    this.subscribers.forEach((fn) => fn());
  }

  get topLayer(): string {
    return this.layers[this.layers.length - 1];
  }

  // ------------------------------------------------------------------ registration
  register(reg: FocusableRegistration): () => void {
    const entry: Entry = { ...reg, seq: this.seq++ };
    this.entries.set(reg.id, entry);
    if (this.pending?.id === reg.id && reg.layerId === this.topLayer) {
      clearTimeout(this.pending.timer);
      this.pending = null;
      queueMicrotask(() => this.focus(reg.id));
    }
    return () => {
      if (this.entries.get(reg.id) !== entry) return;
      this.entries.delete(reg.id);
      if (this.currentId === reg.id) this.scheduleRecovery(entry);
    };
  }

  registerSection(options: SectionOptions): () => void {
    const prev = this.sections.get(options.id);
    this.sections.set(options.id, { ...options, lastFocusedId: prev?.lastFocusedId, cameFromId: prev?.cameFromId });
    return () => {
      // Keep memory (lastFocusedId) so rows remember position across re-mounts; only drop config.
      const s = this.sections.get(options.id);
      if (s) this.sections.set(options.id, { ...s, block: undefined });
    };
  }

  pushLayer(layerId: string) {
    if (this.layers.includes(layerId)) return;
    this.layerReturn.set(layerId, this.currentId);
    this.layers.push(layerId);
  }

  popLayer(layerId: string) {
    const idx = this.layers.indexOf(layerId);
    if (idx <= 0) return;
    this.layers.splice(idx, 1);
    const back = this.layerReturn.get(layerId);
    this.layerReturn.delete(layerId);
    if (idx === this.layers.length) {
      // Restore focus in the layer that is now on top.
      if (back && this.entries.get(back)?.layerId === this.topLayer && this.focus(back)) return;
      this.focusFirst();
    }
  }

  addActionListener(fn: ActionListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  addBackHandler(fn: BackHandler): () => void {
    this.backHandlers.push(fn);
    return () => {
      this.backHandlers = this.backHandlers.filter((h) => h !== fn);
    };
  }

  // ------------------------------------------------------------------ queries
  isRegistered(id: string) {
    return this.entries.has(id);
  }

  getSectionOf(id: string | null): string | null {
    return (id && this.entries.get(id)?.sectionId) || null;
  }

  sectionLastFocused(sectionId: string): string | undefined {
    return this.sections.get(sectionId)?.lastFocusedId;
  }

  private usable(e: Entry | undefined): e is Entry {
    if (!e || !e.el.isConnected || e.layerId !== this.topLayer) return false;
    if (e.getHandlers().disabled) return false;
    const r = e.el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  }

  private isChrome(e: Entry): boolean {
    return !!(e.sectionId && this.sections.get(e.sectionId)?.excludeFromMemory);
  }

  private pool(): Entry[] {
    return [...this.entries.values()].filter((e) => this.usable(e));
  }

  private static rect(el: HTMLElement): Rect {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  private domOrder(list: Entry[]): Entry[] {
    return list.sort((a, b) => {
      if (a.el === b.el) return 0;
      const pos = a.el.compareDocumentPosition(b.el);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : pos & Node.DOCUMENT_POSITION_PRECEDING ? 1 : a.seq - b.seq;
    });
  }

  // ------------------------------------------------------------------ focusing
  focus(id: string, opts: { scroll?: boolean; pointer?: boolean; remember?: boolean } = {}): boolean {
    const entry = this.entries.get(id);
    if (!this.usable(entry)) return false;
    const prevId = this.currentId;
    const prev = prevId ? this.entries.get(prevId) : undefined;
    if (prev && prev !== entry) prev.el.removeAttribute('data-focused');

    this.currentId = id;
    entry.el.setAttribute('data-focused', 'true');
    if (document.activeElement !== entry.el) {
      try {
        entry.el.focus({ preventScroll: true });
      } catch {
        entry.el.focus();
      }
    }
    const sec = entry.sectionId ? this.sections.get(entry.sectionId) : undefined;
    if (sec) {
      if (sec.returnFocus && prev && prev.sectionId !== entry.sectionId) sec.cameFromId = prev.id;
      sec.lastFocusedId = id;
    }
    if (this.screenKey && entry.layerId === 'root' && !sec?.excludeFromMemory && opts.remember !== false) this.memory.set(this.screenKey, id);
    if (opts.scroll !== false && !opts.pointer) ensureVisible(entry.el, this.smoothScroll);
    this.lastRect = FocusManager.rect(entry.el);
    if (prevId !== id) {
      entry.getHandlers().onFocus?.();
      this.notify();
    }
    return true;
  }

  /** Focus `id` now, or as soon as it registers (content may still be loading). */
  requestFocus(id: string | undefined, fallbackMs = 1500) {
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = null;
    if (!id) {
      this.focusFirst();
      return;
    }
    if (this.focus(id)) return;
    this.pending = {
      id,
      timer: setTimeout(() => {
        this.pending = null;
        if (!this.currentId || !this.usable(this.entries.get(this.currentId))) this.focusFirst();
      }, fallbackMs),
    };
  }

  focusFirst(sectionId?: string): boolean {
    const candidates = this.domOrder(this.pool().filter((e) => !sectionId || e.sectionId === sectionId));
    // Prefer content over the navigation bar when landing on a screen.
    const preferred = candidates.find((e) => !this.isChrome(e)) ?? candidates[0];
    return preferred ? this.focus(preferred.id) : false;
  }

  focusSection(sectionId: string): boolean {
    const sec = this.sections.get(sectionId);
    if (sec?.lastFocusedId && this.focus(sec.lastFocusedId)) return true;
    const def = sec?.defaultId?.();
    if (def && this.focus(def)) return true;
    return this.focusFirst(sectionId);
  }

  private scheduleRecovery(removed: Entry) {
    if (this.recoverScheduled) return;
    this.recoverScheduled = true;
    requestAnimationFrame(() => {
      this.recoverScheduled = false;
      if (this.currentId && this.usable(this.entries.get(this.currentId))) return;
      if (this.pending) return;
      // 1) same section, nearest to where focus was; 2) anything nearest; 3) first.
      const pool = this.pool();
      const from = this.lastRect;
      const nearest = (list: Entry[]) => {
        if (!from || !list.length) return list[0];
        const c = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
        return list
          .map((e) => {
            const r = e.el.getBoundingClientRect();
            return { e, d: Math.hypot(r.left + r.width / 2 - c.x, r.top + r.height / 2 - c.y) };
          })
          .sort((a, b) => a.d - b.d)[0]?.e;
      };
      const target = nearest(pool.filter((e) => e.sectionId && e.sectionId === removed.sectionId)) ?? nearest(pool.filter((e) => !this.isChrome(e))) ?? pool[0];
      // Automatic recovery must not overwrite the screen's remembered focus (screens may be mid-transition).
      if (target) this.focus(target.id, { remember: false });
      else {
        this.currentId = null;
        this.notify();
      }
    });
  }

  // ------------------------------------------------------------------ movement
  move(dir: Direction): boolean {
    const cur = this.currentId ? this.entries.get(this.currentId) : undefined;
    if (!this.usable(cur)) return this.focusFirst();
    const from = FocusManager.rect(cur.el);
    const pool = this.pool().filter((e) => e !== cur);
    const toCandidates = (list: Entry[]) => list.map((e) => ({ id: e.id, rect: FocusManager.rect(e.el) }));

    // 1) inside the current section
    if (cur.sectionId) {
      const inside = findBest(from, toCandidates(pool.filter((e) => e.sectionId === cur.sectionId)), dir);
      if (inside) return this.focus(inside.id);
      const sec = this.sections.get(cur.sectionId);
      if (sec?.block?.includes(dir)) return false;
      if (sec?.returnFocus && sec.cameFromId) {
        const back = this.entries.get(sec.cameFromId);
        if (this.usable(back) && back.sectionId !== cur.sectionId && isInDirection(from, FocusManager.rect(back.el), dir, 40)) {
          return this.focus(back.id);
        }
      }
    }

    // 2) geometric best outside the section
    const best = findBest(from, toCandidates(pool.filter((e) => !cur.sectionId || e.sectionId !== cur.sectionId)), dir);
    if (!best) return false;
    const target = this.entries.get(best.id)!;
    const tsec = target.sectionId ? this.sections.get(target.sectionId) : undefined;
    if (tsec) {
      const enterTo = tsec.enterTo ?? 'last';
      if (enterTo === 'last' && tsec.lastFocusedId && tsec.lastFocusedId !== best.id) {
        const last = this.entries.get(tsec.lastFocusedId);
        if (this.usable(last) && isInDirection(from, FocusManager.rect(last.el), dir, 40) && this.focus(last.id)) return true;
      }
      if (enterTo === 'default') {
        const def = tsec.defaultId?.();
        if (def && def !== best.id && this.focus(def)) return true;
      }
      if (enterTo === 'first') {
        const first = this.domOrder(pool.filter((e) => e.sectionId === tsec.id))[0];
        if (first && this.focus(first.id)) return true;
      }
    }
    return this.focus(best.id);
  }

  select() {
    const cur = this.currentId ? this.entries.get(this.currentId) : undefined;
    if (!this.usable(cur)) return;
    const { onSelect } = cur.getHandlers();
    if (onSelect) onSelect();
    else cur.el.click();
  }

  back() {
    for (let i = this.backHandlers.length - 1; i >= 0; i--) {
      if (this.backHandlers[i]() === true) return;
    }
    this.defaultBack?.();
  }

  // ------------------------------------------------------------------ screen memory
  setScreen(key: string) {
    this.screenKey = key;
  }

  rememberedFor(key: string): string | undefined {
    return this.memory.get(key);
  }

  forget(key: string) {
    this.memory.delete(key);
  }

  // ------------------------------------------------------------------ input
  handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && !['ArrowUp', 'ArrowDown', 'Escape', 'Enter'].includes(e.key)) {
      return; // let native text inputs handle typing
    }
    const ev = { ...mapKeyEvent(e, this.platform), repeat: e.repeat };
    if (!ev.action && ev.digit === undefined && !ev.char && !ev.backspace) return;
    if (this.dispatch(ev)) e.preventDefault();
  };

  /** Dispatches a normalised action. Returns true if it was handled. */
  dispatch(ev: ActionEvent & { repeat?: boolean }): boolean {
    const event = { ...ev, repeat: !!ev.repeat };
    for (let i = this.listeners.length - 1; i >= 0; i--) {
      if (this.listeners[i](event) === true) return true;
    }
    if (event.backspace) {
      // Optional Back shortcut (screens with text entry consume Backspace first).
      this.back();
      return true;
    }
    switch (event.action) {
      case 'up':
      case 'down':
      case 'left':
      case 'right': {
        const now = performance.now();
        if (event.repeat && now - this.lastMoveAt < REPEAT_THROTTLE_MS) return true;
        this.lastMoveAt = now;
        this.move(event.action);
        return true;
      }
      case 'enter':
        this.select();
        return true;
      case 'back':
        this.back();
        return true;
      default:
        return false;
    }
  }
}

export const focusManager = new FocusManager();
