import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { focusManager, type ActionListener, type FocusManager, type SectionOptions } from './FocusManager';
import { registerPlatformKeys } from './keymap';

interface FocusCtx {
  manager: FocusManager;
  sectionId: string | null;
  layerId: string;
}

const Ctx = createContext<FocusCtx>({ manager: focusManager, sectionId: null, layerId: 'root' });

export function FocusProvider({ children, manager = focusManager }: { children: ReactNode; manager?: FocusManager }) {
  useEffect(() => {
    registerPlatformKeys(manager.platform);
    const onKey = (e: KeyboardEvent) => manager.handleKeyDown(e);
    // Native wrappers (Android TV) can forward hardware Back as a DOM event: window.dispatchEvent(new Event('tvback')).
    const onTvBack = () => manager.dispatch({ action: 'back' });
    window.addEventListener('keydown', onKey);
    window.addEventListener('tvback', onTvBack);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('tvback', onTvBack);
    };
  }, [manager]);
  const value = useMemo(() => ({ manager, sectionId: null, layerId: 'root' }), [manager]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useFocusManager = () => useContext(Ctx).manager;

type SectionProps = Omit<SectionOptions, 'layerId' | 'defaultId'> & { children: ReactNode; defaultId?: string };

/** Groups focusables (row, grid, toolbar). Renders no DOM. */
export function FocusSection({ id, enterTo, defaultId, block, returnFocus, excludeFromMemory, children }: SectionProps) {
  const parent = useContext(Ctx);
  const defaultRef = useRef(defaultId);
  defaultRef.current = defaultId;
  const blockKey = block?.join(',');
  useLayoutEffect(
    () =>
      parent.manager.registerSection({
        id,
        layerId: parent.layerId,
        enterTo,
        block,
        returnFocus,
        excludeFromMemory,
        defaultId: () => defaultRef.current,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parent.manager, parent.layerId, id, enterTo, blockKey, returnFocus, excludeFromMemory],
  );
  const value = useMemo(() => ({ ...parent, sectionId: id }), [parent, id]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * A modal focus layer: while mounted, only focusables inside it are reachable.
 * On unmount, focus returns to where it was before the layer opened.
 */
export function FocusLayer({ id, children, initialFocus }: { id: string; children: ReactNode; initialFocus?: string }) {
  const parent = useContext(Ctx);
  useLayoutEffect(() => {
    parent.manager.pushLayer(id);
    return () => parent.manager.popLayer(id);
  }, [parent.manager, id]);
  useEffect(() => {
    // Wait for children to register.
    const raf = requestAnimationFrame(() => parent.manager.requestFocus(initialFocus));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent.manager, id]);
  const value = useMemo(() => ({ manager: parent.manager, sectionId: null, layerId: id }), [parent.manager, id]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export interface UseFocusableOptions {
  id: string;
  onSelect?: () => void;
  onFocus?: () => void;
  disabled?: boolean;
}

export function useIsFocused(id: string): boolean {
  const manager = useFocusManager();
  return useSyncExternalStore(manager.subscribe, () => manager.currentId === id, () => false);
}

export function useFocusedId(): string | null {
  const manager = useFocusManager();
  return useSyncExternalStore(manager.subscribe, () => manager.currentId, () => null);
}

export function useFocusable<T extends HTMLElement = HTMLElement>({ id, onSelect, onFocus, disabled }: UseFocusableOptions) {
  const { manager, sectionId, layerId } = useContext(Ctx);
  const ref = useRef<T | null>(null);
  const handlers = useRef({ onSelect, onFocus, disabled });
  handlers.current = { onSelect, onFocus, disabled };

  useLayoutEffect(() => {
    if (!ref.current) return;
    return manager.register({ id, el: ref.current, sectionId, layerId, getHandlers: () => handlers.current });
  }, [manager, id, sectionId, layerId]);

  const focused = useIsFocused(id);

  const props = {
    tabIndex: -1,
    'data-focus-id': id,
    // Pointer remotes (e.g. LG Magic Remote) and mice: follow real movement only. Chromium also fires synthetic
    // hover events when content moves under a resting cursor, which must not steal remote-control focus.
    onMouseMove: (e: { movementX: number; movementY: number }) => {
      if ((e.movementX || e.movementY) && !handlers.current.disabled && manager.currentId !== id) manager.focus(id, { pointer: true });
    },
    onClick: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      if (handlers.current.disabled) return;
      manager.focus(id, { pointer: true });
      if (handlers.current.onSelect) handlers.current.onSelect();
    },
  };
  return { ref, focused, props };
}

type FocusableProps = {
  as?: ElementType;
  focusId: string;
  onSelect?: () => void;
  onFocused?: () => void;
  disabled?: boolean;
} & Omit<HTMLAttributes<HTMLElement>, 'onSelect'>;

/** Convenience wrapper: renders `as` (default <button>) registered with the focus manager. */
export const Focusable = forwardRef<HTMLElement, FocusableProps>(function Focusable(
  { as, focusId, onSelect, onFocused, disabled, ...rest },
  forwarded,
) {
  const Comp = (as ?? 'button') as ElementType;
  const { ref, props } = useFocusable<HTMLElement>({ id: focusId, onSelect, onFocus: onFocused, disabled });
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      ref.current = el;
      if (typeof forwarded === 'function') forwarded(el);
      else if (forwarded) forwarded.current = el;
    },
    [ref, forwarded],
  );
  return (
    <Comp
      ref={setRef}
      {...(Comp === 'button' ? { type: 'button' } : {})}
      aria-disabled={disabled || undefined}
      {...rest}
      {...props}
    />
  );
});

/** Receives every remote/keyboard action before default navigation. Return true to consume it. */
export function useActionListener(fn: ActionListener, enabled = true) {
  const manager = useFocusManager();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    return manager.addActionListener((e) => ref.current(e));
  }, [manager, enabled]);
}

/** Registers a Back handler (most recently registered runs first). Return true to consume Back. */
export function useBackHandler(fn: () => boolean | void, enabled = true) {
  const manager = useFocusManager();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    return manager.addBackHandler(() => ref.current());
  }, [manager, enabled]);
}

/**
 * Restores the last focused element for `screenKey` (or focuses `defaultId`) once `ready`.
 * Also restores the window scroll position saved for the screen.
 */
export function useScreenFocus(screenKey: string, { defaultId, ready = true }: { defaultId?: string; ready?: boolean } = {}) {
  const manager = useFocusManager();
  const done = useRef<string | null>(null);
  useLayoutEffect(() => {
    manager.setScreen(screenKey);
  }, [manager, screenKey]);
  useEffect(() => {
    if (!ready || done.current === screenKey) return;
    const remembered = manager.rememberedFor(screenKey);
    const savedScroll = scrollMemory.get(screenKey);
    const raf = requestAnimationFrame(() => {
      // Marked done only once it actually ran (StrictMode runs effects twice and cancels the first frame).
      done.current = screenKey;
      if (remembered && savedScroll !== undefined) window.scrollTo(0, savedScroll);
      else if (!remembered) window.scrollTo(0, 0);
      manager.requestFocus(remembered ?? defaultId);
    });
    return () => cancelAnimationFrame(raf);
  }, [manager, screenKey, ready, defaultId]);
  useEffect(() => {
    const save = () => scrollMemory.set(screenKey, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      save();
      window.removeEventListener('scroll', save);
    };
  }, [screenKey]);
}

const scrollMemory = new Map<string, number>();
