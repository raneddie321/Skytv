/**
 * Keeps the focused element visible. Rows mark their horizontal scroller with `data-scroll-x`; the block that should be
 * fully visible vertically (row title + cards) is marked with `data-scroll-anchor`. Vertical scrolling uses
 * the nearest `data-scroll-y` container, or the window.
 */
const TOP_MARGIN_VAR = '--scroll-top-margin';

function px(value: string | null | undefined, fallback: number): number {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) ? n : fallback;
}

function scrollTo(target: Element | Window, opts: ScrollToOptions, smooth: boolean) {
  const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
  if ('scrollTo' in target && typeof target.scrollTo === 'function') {
    try {
      target.scrollTo({ ...opts, behavior });
      return;
    } catch {
      /* old engines without ScrollToOptions */
    }
  }
  if (target === window) window.scrollTo(opts.left ?? window.scrollX, opts.top ?? window.scrollY);
  else {
    const el = target as Element;
    if (opts.left !== undefined) el.scrollLeft = opts.left;
    if (opts.top !== undefined) el.scrollTop = opts.top;
  }
}

export function ensureVisible(el: HTMLElement, smooth = true) {
  // Horizontal (row) scrolling
  const row = el.closest<HTMLElement>('[data-scroll-x]');
  if (row) {
    const r = el.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    const cs = getComputedStyle(row);
    // `data-scroll-inset` (rem) accounts for sticky columns overlaying the scroller (e.g. the EPG channel column).
    const rootPx = px(getComputedStyle(document.documentElement).fontSize, 16);
    const inset = row.dataset.scrollInset ? px(row.dataset.scrollInset, 0) * rootPx : 0;
    const padL = px(cs.paddingLeft, 0) + inset;
    const padR = px(cs.paddingRight, 0);
    let delta = 0;
    if (r.left < rr.left + padL) delta = r.left - (rr.left + padL);
    else if (r.right > rr.right - padR) delta = r.right - (rr.right - padR);
    if (Math.abs(delta) > 1) scrollTo(row, { left: row.scrollLeft + delta }, smooth);
  }

  // Vertical scrolling
  const anchor = el.closest<HTMLElement>('[data-scroll-anchor]') ?? el;
  const container = el.closest<HTMLElement>('[data-scroll-y]');
  if (anchor.dataset.scrollAnchor === 'top') {
    scrollTo(container ?? window, { top: 0 }, smooth);
    return;
  }
  const ar = anchor.getBoundingClientRect();
  if (container) {
    const cr = container.getBoundingClientRect();
    const margin = px(container.dataset.scrollMargin, cr.height * 0.08);
    let delta = 0;
    if (ar.top < cr.top + margin) delta = ar.top - (cr.top + margin);
    else if (ar.bottom > cr.bottom - margin) delta = Math.min(ar.bottom - (cr.bottom - margin), ar.top - (cr.top + margin));
    if (Math.abs(delta) > 1) scrollTo(container, { top: container.scrollTop + delta }, smooth);
    return;
  }
  const vh = window.innerHeight;
  const top = px(getComputedStyle(document.documentElement).getPropertyValue(TOP_MARGIN_VAR), vh * 0.12);
  const bottomMargin = vh * 0.06;
  let delta = 0;
  if (ar.top < top) delta = ar.top - top;
  else if (ar.bottom > vh - bottomMargin) delta = Math.min(ar.bottom - (vh - bottomMargin), ar.top - top);
  if (Math.abs(delta) > 1) scrollTo(window, { top: window.scrollY + delta }, smooth);
}
