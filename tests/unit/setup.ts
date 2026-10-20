// jsdom lacks a few browser APIs used by the app (setup also runs for node-environment tests).
if (typeof window !== 'undefined') {
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
window.scrollTo = (() => undefined) as typeof window.scrollTo;
Element.prototype.scrollTo = function scrollTo(this: Element, opts?: ScrollToOptions | number) {
  if (typeof opts === 'object' && opts) {
    if (opts.left !== undefined) this.scrollLeft = opts.left;
    if (opts.top !== undefined) this.scrollTop = opts.top;
  }
} as typeof Element.prototype.scrollTo;
}
