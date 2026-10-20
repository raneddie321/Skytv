import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CHANNEL_CATEGORIES } from '@/api/fixtures/live';
import { Icon } from '@/components/Icon';
import { ErrorState } from '@/components/ui';
import { paths } from '@/app/paths';
import { FocusSection, Focusable, useActionListener } from '@/navigation/react';
import { useLibrary, useProfileLibrary } from '@/state/library';
import { useActiveProfile } from '@/state/profiles';
import { getServices } from '@/api';
import { ChannelsView } from './ChannelsView';
import { GuideView } from './GuideView';
import { NowNextView } from './NowNextView';
import { useLiveData, type CategoryFilter } from './useLiveData';
import styles from './LiveTv.module.css';

type Tab = 'channels' | 'now-next' | 'guide';
const TABS: { id: Tab; label: string; icon: 'list' | 'grid' | 'calendar'; path: string }[] = [
  { id: 'channels', label: 'Channels', icon: 'list', path: paths.live },
  { id: 'now-next', label: 'Now & Next', icon: 'grid', path: paths.liveNowNext },
  { id: 'guide', label: 'TV Guide', icon: 'calendar', path: paths.liveGuide },
];

export default function LiveTv() {
  const { tab: tabParam } = useParams();
  const tab: Tab = tabParam === 'guide' ? 'guide' : tabParam === 'now-next' ? 'now-next' : 'channels';
  const navigate = useNavigate();
  const profile = useActiveProfile()!;
  const library = useProfileLibrary(profile.id);
  const toggleFavourite = useLibrary((s) => s.toggleFavouriteChannel);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const data = useLiveData(filter, library.favouriteChannels);
  const [digits, setDigits] = useState('');
  const digitTimer = useRef<ReturnType<typeof setTimeout>>();

  // Direct channel number entry with the remote's number keys.
  useActionListener((e) => {
    if (e.digit === undefined) return false;
    const next = (digits + e.digit).slice(-3);
    setDigits(next);
    clearTimeout(digitTimer.current);
    digitTimer.current = setTimeout(async () => {
      setDigits('');
      const channels = await getServices().live.getChannels();
      const hit = channels.find((c) => c.number === Number(next));
      if (hit) navigate(paths.watch({ kind: 'channel', channelId: hit.id }));
    }, 1400);
    return true;
  });

  const watch = (channelId: string) => navigate(paths.watch({ kind: 'channel', channelId }));
  const favourites = new Set(library.favouriteChannels);

  return (
    <div className={styles.page} data-testid={`live-${tab}`}>
      <header className={styles.header} data-scroll-anchor="top">
        <div className={styles.titleRow}>
          <h1 className={styles.heading}>Live TV</h1>
          <span className={styles.demo}>
            <Icon name="info" size="1rem" /> Demo channels and schedules — not real broadcast data
          </span>
        </div>
        <FocusSection id="live-tabs" enterTo="default" defaultId={`live-tab:${tab}`}>
          <div className={styles.tabs} role="tablist">
            {TABS.map((t) => (
              <Focusable
                key={t.id}
                focusId={`live-tab:${t.id}`}
                role="tab"
                aria-selected={t.id === tab}
                className={`${styles.tab} ${t.id === tab ? styles.tabActive : ''}`}
                onSelect={() => navigate(t.path, { replace: true })}
                data-testid={`live-tab-${t.id}`}
              >
                <Icon name={t.icon} size="1.1rem" />
                {t.label}
              </Focusable>
            ))}
          </div>
        </FocusSection>
        <FocusSection id="live-categories" enterTo="last">
          <div className={`${styles.categories} no-scrollbar`} data-scroll-x>
            {CHANNEL_CATEGORIES.map((c) => (
              <Focusable
                key={c.id}
                focusId={`live-cat:${c.id}`}
                className={`${styles.category} ${filter === c.id ? styles.categoryActive : ''}`}
                onSelect={() => setFilter(c.id)}
                data-testid={`live-cat-${c.id}`}
              >
                {c.id === 'favourites' ? <Icon name="heart" size="1rem" /> : null}
                {c.label}
              </Focusable>
            ))}
          </div>
        </FocusSection>
      </header>

      {data.error ? (
        <ErrorState title="TV guide unavailable" message="We couldn’t load channels. Please try again." onRetry={data.retry} />
      ) : tab === 'channels' ? (
        <ChannelsView data={data} favourites={favourites} onWatch={watch} onToggleFavourite={(id) => toggleFavourite(profile.id, id)} />
      ) : tab === 'now-next' ? (
        <NowNextView data={data} favourites={favourites} onWatch={watch} />
      ) : (
        <GuideView data={data} favourites={favourites} onWatch={watch} />
      )}
      {!data.loading && !data.rows.length && !data.error ? (
        <p className={styles.empty}>
          {filter === 'favourites' ? 'No favourite channels yet. Select the heart next to a channel to add it.' : 'No channels in this category.'}
        </p>
      ) : null}
      {digits ? (
        <div className={styles.digits} aria-live="assertive">
          {digits}
        </div>
      ) : null}
    </div>
  );
}
