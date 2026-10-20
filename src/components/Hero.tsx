import { useEffect, useState } from 'react';
import type { MediaSummary } from '@/api/contracts/domain';
import { brand } from '@/config/brand';
import { isOriginal } from '@/config/originals';
import { FocusSection, useActionListener, useFocusedId } from '@/navigation/react';
import { useSettings, prefersReducedMotion } from '@/state/settings';
import { Img } from './Img';
import { TitleArt } from './TitleArt';
import { PillButton, Skeleton } from './ui';
import styles from './Hero.module.css';

interface HeroProps {
  id: string;
  items: MediaSummary[] | undefined;
  loading?: boolean;
  onPlay: (item: MediaSummary) => void;
  onDetails: (item: MediaSummary) => void;
  onToggleList?: (item: MediaSummary) => void;
  inList?: (id: string) => boolean;
  playLabel?: (item: MediaSummary) => string;
  compact?: boolean;
  eyebrow?: string;
}

const ROTATE_MS = 9000;

export function Hero({ id, items, loading, onPlay, onDetails, onToggleList, inList, playLabel, compact, eyebrow }: HeroProps) {
  const [index, setIndex] = useState(0);
  const focusedId = useFocusedId();
  const focusedInHero = !!focusedId?.startsWith(`${id}:`);
  const reduceMotion = prefersReducedMotion(useSettings((s) => s.accessibility.reduceMotion));
  const list = items ?? [];
  const item = list[index % Math.max(1, list.length)];

  useEffect(() => {
    if (list.length < 2 || focusedInHero || reduceMotion) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % list.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [list.length, focusedInHero, reduceMotion]);

  // Left on the first button / Right on the last button switches slides.
  useActionListener((e) => {
    if (!focusedInHero || list.length < 2) return false;
    if (e.action === 'left' && focusedId === `${id}:play`) {
      setIndex((i) => (i - 1 + list.length) % list.length);
      return true;
    }
    if (e.action === 'right' && focusedId === `${id}:${onToggleList ? 'list' : 'info'}`) {
      setIndex((i) => (i + 1) % list.length);
      return true;
    }
    return false;
  });

  if (loading || !item) {
    return (
      <section className={`${styles.hero} ${compact ? styles.compact : ''}`} aria-busy="true">
        <div className={styles.content}>
          <Skeleton className={styles.skTitle} />
          <Skeleton className={styles.skText} />
          <Skeleton className={styles.skText} style={{ width: '60%' }} />
        </div>
      </section>
    );
  }

  const meta = [item.year, item.genres.slice(0, 2).map((g) => g.name).join(', '), item.certification].filter(Boolean);
  const original = isOriginal(item.id);
  const listed = inList?.(item.id);

  return (
    <section className={`${styles.hero} ${compact ? styles.compact : ''}`} data-scroll-anchor="top" aria-roledescription="carousel" data-testid={`hero-${id}`}>
      <div className={styles.backdrop} key={item.id}>
        <Img src={item.backdropUrl} alt="" width={1600} eager position="70% 30%" />
      </div>
      <div className={styles.scrimLeft} />
      <div className={styles.scrimBottom} />
      <div className={styles.content}>
        {original ? (
          <div className={styles.eyebrow}>
            <b>{brand.wordmark}</b> {brand.originalsLabel}
          </div>
        ) : eyebrow ? (
          <div className={styles.eyebrowPlain}>{eyebrow}</div>
        ) : null}
        <h1 className={styles.title}>
          <TitleArt title={item.title} style={item.titleStyle} size="xl" />
        </h1>
        {meta.length ? <div className={styles.meta}>{meta.join('  ·  ')}</div> : null}
        <p className={styles.overview}>{item.overview}</p>
        <FocusSection id={id}>
          <div className={styles.buttons}>
            <PillButton focusId={`${id}:play`} variant="primary" icon="play" label={playLabel?.(item) ?? 'Play'} onSelect={() => onPlay(item)} />
            <PillButton focusId={`${id}:info`} icon="info" label="More info" onSelect={() => onDetails(item)} />
            {onToggleList ? (
              <PillButton
                focusId={`${id}:list`}
                icon={listed ? 'check' : 'plus'}
                ariaLabel={listed ? 'Remove from My List' : 'Add to My List'}
                onSelect={() => onToggleList(item)}
              />
            ) : null}
          </div>
        </FocusSection>
        {list.length > 1 ? (
          <div className={styles.dots} aria-hidden="true">
            {list.map((m, i) => (
              <span key={m.id} className={i === index % list.length ? styles.dotActive : ''} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
