/** Minimal stroke icon set (24×24, currentColor). */
const PATHS = {
  home: 'M3.5 10.5 12 3.5l8.5 7V20a.5.5 0 0 1-.5.5h-5v-6h-6v6H4a.5.5 0 0 1-.5-.5z',
  live: 'M3.5 6.5h17v11h-17zM8 21h8M12 17.5V21M9 2.8l3 3.2 3-3.2',
  tv: 'M2.8 5.5h18.4v11.5H2.8zM8 20.5h8',
  movies: 'M3.5 4.5h17v15h-17zM7.5 4.5v15M16.5 4.5v15M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4',
  originals: 'm12 3.2 2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.5l-5.4 2.9 1.2-5.9-4.4-4.1 6-.7z',
  apps: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  search: 'M10.8 18.1a7.3 7.3 0 1 0 0-14.6 7.3 7.3 0 0 0 0 14.6zM16 16l4.8 4.8',
  settings:
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.4h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.4z',
  bookmark: 'M6 3.5h12v17l-6-4.2-6 4.2z',
  bookmarkFilled: 'M6 3.5h12v17l-6-4.2-6 4.2z',
  play: 'M7 4.5v15l12.5-7.5z',
  pause: 'M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z',
  plus: 'M12 4.5v15M4.5 12h15',
  check: 'm4.5 12.5 4.8 4.8L19.5 7',
  back: 'M15 4.5 7.5 12l7.5 7.5',
  chevronRight: 'm9 4.5 7.5 7.5L9 19.5',
  chevronLeft: 'M15 4.5 7.5 12l7.5 7.5',
  chevronDown: 'm4.5 9 7.5 7.5L19.5 9',
  chevronUp: 'm4.5 15 7.5-7.5 7.5 7.5',
  replay10: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 3.5v3.7h3.7M10 10v5M13 10h2v5h-2z',
  forward10: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 3.5v3.7h-3.7M9.5 10v5M12.5 10h2v5h-2z',
  next: 'M5 4.5v15l10-7.5zM18 4.5v15',
  volume: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11',
  volumeMute: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5',
  subtitles: 'M3 5.5h18v13H3zM6.5 12.5h4M13 12.5h4.5M6.5 15.5h7M15.5 15.5h2',
  fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  exitFullscreen: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.4 4.4 0 0 1 12 7.3 4.4 4.4 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z',
  lock: 'M6 10.5h12v10H6zM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.6v.4',
  wifi: 'M2.5 8.5a14 14 0 0 1 19 0M5.5 11.8a9.5 9.5 0 0 1 13 0M8.7 15a5 5 0 0 1 6.6 0M12 18.5h.01',
  user: 'M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4zM4 20.5a8 8 0 0 1 16 0',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z',
  accessibility: 'M12 6.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zM5 8.5l7 1.5 7-1.5M12 10v4.5l-3 6.5M12 14.5l3 6.5',
  shield: 'M12 2.8 19.5 6v5.5c0 4.7-3.2 8.3-7.5 9.7-4.3-1.4-7.5-5-7.5-9.7V6z',
  card: 'M3 5.5h18v13H3zM3 9.5h18M6.5 15h4',
  grid: 'M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z',
  list: 'M8 6h12.5M8 12h12.5M8 18h12.5M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  edit: 'M4 20h4L19.5 8.5l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14',
  backspace: 'M8.5 5H21v14H8.5L2.5 12zM11.5 9l6 6M17.5 9l-6 6',
  space: 'M4 10v4h16v-4',
  exit: 'M10 4.5H4.5v15H10M15 8l4 4-4 4M19 12H9',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5.2l3.2 2',
  calendar: 'M4 5.5h16v15H4zM4 10h16M8.5 3v4M15.5 3v4',
  star: 'm12 3.2 2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.5l-5.4 2.9 1.2-5.9-4.4-4.1 6-.7z',
  close: 'M5.5 5.5l13 13M18.5 5.5l-13 13',
  music: 'M9 18V5.5l11-2V16M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM20 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  gamepad: 'M7 7.5h10a4.5 4.5 0 0 1 4.3 5.8l-1.2 3.9a2.3 2.3 0 0 1-3.9.9L14 15.5h-4l-2.2 2.6a2.3 2.3 0 0 1-3.9-.9l-1.2-3.9A4.5 4.5 0 0 1 7 7.5zM7.5 10.5v3M6 12h3M15.5 11.2h.01M17.5 13h.01',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  photo: 'M3.5 5h17v14h-17zM3.5 15.5l5-4.5 4 3.5 3-2.5 5 4M15.5 9.5h.01',
  news: 'M4 4.5h13v15H6a2 2 0 0 1-2-2zM17 8.5h3v9a2 2 0 0 1-4 0M7.5 8.5h6M7.5 12h6M7.5 15.5h4',
  fitness: 'M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12',
  refresh: 'M19.5 8.5A8 8 0 1 0 20 13M20 4v4.5h-4.5',
} as const;

export type IconName = keyof typeof PATHS;
const FILLED: Partial<Record<IconName, true>> = { play: true, pause: true, bookmarkFilled: true, next: true };

export function Icon({ name, size = '1.2em', className, title }: { name: IconName; size?: string; className?: string; title?: string }) {
  const filled = FILLED[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none' }}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
