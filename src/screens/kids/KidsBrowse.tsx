import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MediaType } from '@/api/contracts/domain';
import { useInfiniteRail } from '@/api/hooks';
import { Grid } from '@/components/Grid';
import { paths } from '@/app/paths';
import { useScreenFocus } from '@/navigation/react';
import { useSettings } from '@/state/settings';
import { kidsAllowed } from './kidsFilter';
import styles from './Kids.module.css';

export default function KidsBrowse({ type }: { type: MediaType }) {
  const navigate = useNavigate();
  const max = useSettings((s) => s.parental.kidsMaxCertification);
  const q = useInfiniteRail({ kind: 'popular', mediaType: type, audience: 'kids' });
  const items = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.items).filter((i) => kidsAllowed(i, max)), [q.data, max]);
  useScreenFocus(`kids-browse:${type}`, { defaultId: items[0] ? `kids-grid-${type}:${items[0].id}` : undefined, ready: !q.isLoading });
  return (
    <div className={styles.page} data-testid={`kids-browse-${type}`}>
      <h1 className={styles.heading}>{type === 'tv' ? 'TV Shows' : 'Movies'}</h1>
      <Grid
        id={`kids-grid-${type}`}
        items={items}
        loading={q.isLoading}
        loadingMore={q.isFetchingNextPage}
        error={q.isError}
        onRetry={() => q.refetch()}
        onNearEnd={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
        onSelectItem={(i) => navigate(paths.kidsDetail(i.type, i.id))}
        empty="Nothing here yet."
      />
    </div>
  );
}
