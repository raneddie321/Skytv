import { memo, useEffect, useState } from 'react';
import { resizeImage } from '@/api/tmdb/mappers';
import styles from './Img.module.css';

/** URLs that have finished loading during this session (renders them without fade / skeleton). */
const loaded = new Set<string>();
const failed = new Set<string>();

export function preloadImage(url: string | undefined, width = 640) {
  const src = resizeImage(url, width);
  if (!src || loaded.has(src) || failed.has(src)) return;
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => loaded.add(src);
  img.src = src;
}

export function imageSrc(url: string | undefined, cssWidthPx: number): string | undefined {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  return resizeImage(url, Math.round(cssWidthPx * dpr));
}

interface ImgProps {
  src: string | undefined;
  alt: string;
  /** Approximate rendered width in CSS px, used to pick the TMDB size. */
  width: number;
  className?: string;
  eager?: boolean;
  /** Text shown in the generated placeholder when the image is missing or fails. */
  fallbackLabel?: string;
  position?: string;
}

export const Img = memo(function Img({ src, alt, width, className, eager, fallbackLabel, position }: ImgProps) {
  const url = imageSrc(src, width);
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(
    url ? (loaded.has(url) ? 'loaded' : failed.has(url) ? 'error' : 'loading') : 'error',
  );
  useEffect(() => {
    setState(url ? (loaded.has(url) ? 'loaded' : failed.has(url) ? 'error' : 'loading') : 'error');
  }, [url]);

  if (!url || state === 'error') {
    return (
      <div className={`${styles.fallback} ${className ?? ''}`} role="img" aria-label={alt}>
        {fallbackLabel ? <span>{fallbackLabel}</span> : null}
      </div>
    );
  }
  return (
    <img
      className={`${styles.img} ${state === 'loaded' ? styles.loaded : ''} ${className ?? ''}`}
      src={url}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      style={position ? { objectPosition: position } : undefined}
      onLoad={() => {
        loaded.add(url);
        setState('loaded');
      }}
      onError={() => {
        failed.add(url);
        setState('error');
      }}
    />
  );
});
