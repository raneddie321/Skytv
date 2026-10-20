import { useNavigate } from 'react-router-dom';
import type { MediaSummary } from '@/api/contracts/domain';
import { activeOriginalsConfig, useOriginalsCollection } from '@/api/originals';
import { Hero } from '@/components/Hero';
import { MediaRail } from '@/components/Rail';
import { paths } from '@/app/paths';
import { resolvePlayTarget } from '@/app/playback';
import type { OriginalsCollection } from '@/config/originals';
import { useScreenFocus } from '@/navigation/react';
import { toMediaRef, useLibrary, useProfileLibrary } from '@/state/library';
import { useActiveProfile } from '@/state/profiles';
import { toast } from '@/state/toasts';
import styles from './Originals.module.css';

function CollectionRail({ collection, onSelect }: { collection: OriginalsCollection; onSelect: (i: { type: 'movie' | 'tv'; id: string }) => void }) {
  const q = useOriginalsCollection(`originals:${collection.id}`, collection.entries);
  return (
    <MediaRail
      id={`originals-${collection.id}`}
      title={collection.title}
      items={q.data}
      loading={q.isLoading}
      error={q.isError}
      onRetry={() => q.refetch()}
      onSelectItem={onSelect}
      variant="large"
      empty="No titles from this collection are available in the current catalog."
    />
  );
}

/** Curated, configuration-driven originals (src/config/originals.ts). */
export default function Originals() {
  const navigate = useNavigate();
  const profile = useActiveProfile()!;
  const library = useProfileLibrary(profile.id);
  const toggleWatchlist = useLibrary((s) => s.toggleWatchlist);
  const config = activeOriginalsConfig();
  const featured = useOriginalsCollection('originals:featured', config.featured);
  useScreenFocus('originals', { defaultId: 'originals-hero:play', ready: !featured.isLoading });
  const openDetails = (item: { type: 'movie' | 'tv'; id: string }) => navigate(paths.detail(item.type, item.id));

  return (
    <div className={styles.page} data-testid="originals">
      <Hero
        id="originals-hero"
        items={featured.data}
        loading={featured.isLoading}
        onPlay={(item: MediaSummary) => navigate(paths.watch(resolvePlayTarget(item, library.progress).content))}
        onDetails={openDetails}
        playLabel={(item) => resolvePlayTarget(item, library.progress).label}
        inList={(id) => library.watchlist.some((w) => w.id === id)}
        onToggleList={(item) => {
          const added = toggleWatchlist(profile.id, toMediaRef(item));
          toast(added ? `Added ${item.title} to My List` : `Removed ${item.title} from My List`);
        }}
      />
      <div className={styles.rows}>
        {config.collections.map((c) => (
          <CollectionRail key={c.id} collection={c} onSelect={openDetails} />
        ))}
        <p className={styles.note}>Curated from the editorial originals configuration. Badges are never inferred from third-party metadata.</p>
      </div>
    </div>
  );
}
