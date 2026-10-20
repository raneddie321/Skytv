import { useNavigate } from 'react-router-dom';
import { Grid } from '@/components/Grid';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/ui';
import { paths, detailPathFor } from '@/app/paths';
import { FocusSection, useScreenFocus } from '@/navigation/react';
import { useProfileLibrary } from '@/state/library';
import { useActiveProfile } from '@/state/profiles';
import styles from './Watchlist.module.css';

/** My List: saved titles for the active profile (persisted per profile). */
export function WatchlistView({ kids = false }: { kids?: boolean }) {
  const navigate = useNavigate();
  const profile = useActiveProfile()!;
  const { watchlist } = useProfileLibrary(profile.id);
  useScreenFocus(kids ? 'kids-list' : 'watchlist', { defaultId: watchlist[0] ? `watchlist:${watchlist[0].id}` : 'watchlist:browse' });
  return (
    <div className={`${styles.page} ${kids ? styles.kids : ''}`} data-testid="watchlist">
      <h1 className={styles.heading}>My List</h1>
      <p className={styles.sub}>
        {watchlist.length ? `${watchlist.length} saved title${watchlist.length === 1 ? '' : 's'} for ${profile.name}` : 'Nothing saved yet.'}
      </p>
      {watchlist.length ? (
        <Grid id="watchlist" items={watchlist} variant="poster" onSelectItem={(i) => navigate(detailPathFor(kids)(i.type, i.id))} />
      ) : (
        <div className={styles.empty}>
          <Icon name="bookmark" size="3rem" />
          <p>Add films and series with the + button on any title. They’ll appear here on this profile.</p>
          <FocusSection id="watchlist-empty">
            <PillButton focusId="watchlist:browse" variant="primary" label="Browse" onSelect={() => navigate(kids ? paths.kids : paths.home)} />
          </FocusSection>
        </div>
      )}
    </div>
  );
}

export default function Watchlist() {
  return <WatchlistView />;
}
