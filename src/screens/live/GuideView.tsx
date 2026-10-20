import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Programme } from '@/api/contracts/domain';
import { ChannelLogo } from '@/components/ChannelLogo';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { Img } from '@/components/Img';
import { Badge, PillButton, Skeleton, formatTime } from '@/components/ui';
import { paths } from '@/app/paths';
import { FocusSection, Focusable, useFocusedId, useScreenFocus } from '@/navigation/react';
import type { useLiveData } from './useLiveData';
import styles from './Guide.module.css';

interface Props {
  data: ReturnType<typeof useLiveData>;
  favourites: Set<string>;
  onWatch: (channelId: string) => void;
}

/** rem per minute on the time axis (30 minutes = 6.6rem). */
const REM_PER_MIN = 0.22;
const CHANNEL_COL_REM = 11;
const SLOT_MIN = 30;

/** Full electronic programme guide: channels × time grid with a live "now" marker and a focused-programme preview. */
export function GuideView({ data, favourites, onWatch }: Props) {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const focusedId = useFocusedId();
  const [selected, setSelected] = useState<Programme | null>(null);
  const [now, setNow] = useState(Date.now());
  const from = data.range.from.getTime();
  const to = data.range.to.getTime();
  const totalMin = (to - from) / 60_000;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, { p: Programme; channelId: string }>();
    data.rows.forEach((r) => r.programmes.forEach((p) => m.set(p.id, { p, channelId: r.channel.id })));
    return m;
  }, [data.rows]);
  const focused = focusedId?.startsWith('epg:') ? byId.get(focusedId.slice(4)) : undefined;
  const focusedChannel = focused ? data.rows.find((r) => r.channel.id === focused.channelId)?.channel : data.rows[0]?.channel;
  const preview = focused?.p ?? data.rows[0]?.now;

  const firstNow = data.rows[0]?.now;
  useScreenFocus('live:guide', { defaultId: firstNow ? `epg:${firstNow.id}` : undefined, ready: !data.loading });

  // Start the grid half an hour before now.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || data.loading) return;
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    el.scrollLeft = Math.max(0, ((now - from) / 60_000 - SLOT_MIN) * REM_PER_MIN * rootPx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loading, from]);

  const slots = useMemo(() => {
    const out: number[] = [];
    for (let t = from; t < to; t += SLOT_MIN * 60_000) out.push(t);
    return out;
  }, [from, to]);

  const x = (t: number) => ((Math.max(from, Math.min(to, t)) - from) / 60_000) * REM_PER_MIN;
  const nowLeft = x(now);

  const openProgramme = (p: Programme, channelId: string) => {
    const s = Date.parse(p.start);
    const e = Date.parse(p.end);
    if (s <= Date.now() && e > Date.now()) onWatch(channelId);
    else setSelected(p);
  };

  return (
    <div className={styles.guide}>
      <section className={styles.preview} aria-live="polite">
        {preview ? (
          <>
            <div className={styles.previewImage}>
              <Img src={preview.imageUrl} alt="" width={420} />
            </div>
            <div className={styles.previewText}>
              <div className={styles.previewMeta}>
                {focusedChannel ? `${focusedChannel.number} ${focusedChannel.name} · ` : ''}
                {formatTime(preview.start)} – {formatTime(preview.end)}
                {preview.certification ? ` · ${preview.certification}` : ''}
                {Date.parse(preview.start) <= now && Date.parse(preview.end) > now ? <Badge tone="live">On now</Badge> : null}
              </div>
              <h2 className={styles.previewTitle}>{preview.title}</h2>
              {preview.subtitle ? <div className={styles.previewSub}>{preview.subtitle}</div> : null}
              <p className={styles.previewSynopsis}>{preview.synopsis}</p>
            </div>
          </>
        ) : (
          <Skeleton className={styles.previewSkeleton} />
        )}
      </section>

      <div ref={scrollerRef} className={`${styles.scroller} no-scrollbar`} data-scroll-x data-scroll-inset={`${CHANNEL_COL_REM + 4.5}`} data-testid="epg">
        <div className={styles.inner} style={{ width: `calc(var(--safe-x) + ${CHANNEL_COL_REM + totalMin * REM_PER_MIN + 2}rem)` }}>
          <div className={styles.timeHeader}>
            <div className={styles.cornerCell}>
              <Icon name="clock" size="1rem" /> {new Date(now).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            <div className={styles.timeTrack}>
              {slots.map((t) => (
                <span key={t} className={styles.timeLabel} style={{ left: `${x(t)}rem` }}>
                  {formatTime(new Date(t))}
                </span>
              ))}
              <span className={styles.nowLabel} style={{ left: `${nowLeft}rem` }}>
                {formatTime(new Date(now))}
              </span>
            </div>
          </div>
          <FocusSection id="epg-grid">
            <div className={styles.rows}>
              <span className={styles.nowLine} style={{ left: `${CHANNEL_COL_REM + nowLeft}rem` }} aria-hidden="true" />
              {data.loading
                ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className={styles.skRow} />)
                : data.rows.map((r) => (
                    <div key={r.channel.id} className={styles.row} data-scroll-anchor data-testid={`epg-row-${r.channel.number}`}>
                      <div className={styles.channelCell}>
                        <span className={styles.channelNumber}>{r.channel.number}</span>
                        <ChannelLogo channel={r.channel} size="sm" />
                        {favourites.has(r.channel.id) ? <Icon name="heart" size="0.85rem" className={styles.fav} /> : null}
                      </div>
                      <div className={styles.track}>
                        {r.programmes.map((p) => {
                          const s = Date.parse(p.start);
                          const e = Date.parse(p.end);
                          if (e <= from || s >= to) return null;
                          const isNow = s <= now && e > now;
                          const isPast = e <= now;
                          return (
                            <Focusable
                              key={p.id}
                              focusId={`epg:${p.id}`}
                              className={`${styles.cell} ${isNow ? styles.cellNow : ''} ${isPast ? styles.cellPast : ''}`}
                              style={{ left: `${x(s)}rem`, width: `${Math.max(0.6, x(e) - x(s) - 0.18)}rem` }}
                              onSelect={() => openProgramme(p, r.channel.id)}
                              aria-label={`${p.title}, ${formatTime(p.start)} to ${formatTime(p.end)}${isNow ? ', on now' : ''}`}
                            >
                              <span className={styles.cellTitle}>{p.title}</span>
                              <span className={styles.cellTime}>
                                {formatTime(p.start)} – {formatTime(p.end)}
                              </span>
                            </Focusable>
                          );
                        })}
                      </div>
                    </div>
                  ))}
            </div>
          </FocusSection>
        </div>
      </div>

      {selected ? (
        <Dialog id="programme" title={selected.title} onClose={() => setSelected(null)} initialFocus={selected.catalogId ? 'prog:title' : 'prog:close'} width="md">
          <p className={styles.dialogMeta}>
            {new Date(selected.start).toLocaleDateString('en-GB', { weekday: 'long' })} · {formatTime(selected.start)} – {formatTime(selected.end)}
            {selected.certification ? ` · ${selected.certification}` : ''}
          </p>
          {selected.subtitle ? <p className={styles.dialogSub}>{selected.subtitle}</p> : null}
          <p className={styles.dialogSynopsis}>{selected.synopsis}</p>
          <FocusSection id="programme-actions">
            <div className={styles.dialogActions}>
              {selected.catalogId ? (
                <PillButton
                  focusId="prog:title"
                  variant="primary"
                  icon="info"
                  label="Available on demand"
                  onSelect={() => navigate(paths.detail(selected.catalogId!.startsWith('demo:movie') ? 'movie' : 'tv', selected.catalogId!))}
                />
              ) : null}
              <PillButton focusId="prog:close" label="Close" onSelect={() => setSelected(null)} />
            </div>
          </FocusSection>
        </Dialog>
      ) : null}
    </div>
  );
}
