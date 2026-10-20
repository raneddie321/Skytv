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
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
  type Ref,
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
export function FocusSection({ id, enterTo, defaultId, block, returnFocus, children }: SectionProps) {
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
        defaultId: () => defaultRef.current,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parent.manager, parent.layerId, id, enterTo, blockKey, returnFocus],
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
    onMouseEnter: () => {
      if (!handlers.current.disabled) manager.focus(id, { pointer: true });
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

type FocusableProps<E extends ElementType> = {
  as?: E;
  focusId: string;
  onSelect?: () => void;
  onFocused?: () => void;
  disabled?: boolean;
} & Omit<ComponentPropsWithoutRef<E>, 'onSelect' | 'disabled'>;

/** Convenience wrapper: renders `as` (default <button>) registered with the focus manager. */
export const Focusable = forwardRef(function Focusable<E extends ElementType = 'button'>(
  { as, focusId, onSelect, onFocused, disabled, ...rest }: FocusableProps<E>,
  forwarded: Ref<HTMLElement>,
) {
  const Comp = (as ?? 'button') as ElementType;
  const { ref, props } = useFocusable<HTMLElement>({ id: focusId, onSelect, onFocus: onFocused, disabled });
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      ref.current = el;
      if (typeof forwarded === 'function') forwarded(el);
      else if (forwarded) (forwarded as { current: HTMLElement | null }).current = el;
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
}) as <E extends ElementType = 'button'>(p: FocusableProps<E> & { ref?: Ref<HTMLElement> }) => JSX.Element;

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
    done.current = screenKey;
    const remembered = manager.rememberedFor(screenKey);
    const savedScroll = scrollMemory.get(screenKey);
    if (remembered && savedScroll !== undefined) window.scrollTo(0, savedScroll);
    else if (!remembered) window.scrollTo(0, 0);
    const raf = requestAnimationFrame(() => manager.requestFocus(remembered ?? defaultId));
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
