import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Audience, MediaType } from '@/api/contracts/domain';
import { useRail, useSearch } from '@/api/hooks';
import { Grid } from '@/components/Grid';
import { Icon } from '@/components/Icon';
import { OnScreenKeyboard } from '@/components/OnScreenKeyboard';
import { detailPathFor } from '@/app/paths';
import { FocusSection, Focusable, useActionListener, useScreenFocus } from '@/navigation/react';
import { useLibrary, useProfileLibrary } from '@/state/library';
import { useActiveProfile } from '@/state/profiles';
import styles from './Search.module.css';

/** Remembers the query per audience while the app is open, so Back from a result restores the results. */
const lastQuery: Record<Audience, string> = { all: '', kids: '' };

export function SearchView({ audience }: { audience: Audience }) {
  const kids = audience === 'kids';
  const navigate = useNavigate();
  const profile = useActiveProfile()!;
  const library = useProfileLibrary(profile.id);
  const addRecent = useLibrary((s) => s.addRecentSearch);
  const clearRecent = useLibrary((s) => s.clearRecentSearches);
  const [query, setQuery] = useState(lastQuery[audience]);
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    lastQuery[audience] = query;
    const t = setTimeout(() => setDebounced(query), 280);
    return () => clearTimeout(t);
  }, [query, audience]);

  const results = useSearch(debounced, audience);
  const suggestions = useRail({ kind: 'trending', mediaType: 'all', audience });
  const hasQuery = debounced.trim().length > 0;
  const items = hasQuery ? results.data?.items ?? [] : suggestions.data?.items ?? [];

  useScreenFocus(kids ? 'kids-search' : 'search', { defaultId: 'osk:a' });

  useActionListener((e) => {
    if (e.backspace) {
      if (!query) return false; // lets Backspace act as Back when there is nothing to delete
      setQuery((q) => q.slice(0, -1));
      return true;
    }
    if (e.char && e.char.length === 1 && e.action !== 'playPause' && /[\p{L}\p{N}' -]/u.test(e.char)) {
      setQuery((q) => (q + e.char).slice(0, 40));
      return true;
    }
    return false;
  });

  const open = (item: { type: MediaType; id: string }) => {
    if (hasQuery) addRecent(profile.id, debounced);
    navigate(detailPathFor(kids)(item.type, item.id));
  };

  return (
    <div className={`${styles.page} ${kids ? styles.kids : ''}`} data-testid="search">
      <div className={styles.left}>
        <div className={styles.field} role="searchbox" aria-label="Search query" data-testid="search-query">
          <Icon name="search" size="1.4rem" />
          <span className={query ? styles.query : styles.placeholder}>{query || (kids ? 'Find a show' : 'Search films, series and more')}</span>
          <span className={styles.caret} />
        </div>
        <OnScreenKeyboard
          onChar={(c) => setQuery((q) => (q + c).slice(0, 40))}
          onDelete={() => setQuery((q) => q.slice(0, -1))}
          onClear={() => setQuery('')}
          size={kids ? 'lg' : 'md'}
        />
        {!kids && library.recentSearches.length ? (
          <section className={styles.recent} aria-label="Recent searches">
            <div className={styles.recentHeader}>
              <h2>Recent searches</h2>
            </div>
            <FocusSection id="recent-searches">
              <div className={styles.recentList}>
                {library.recentSearches.map((q) => (
                  <Focusable key={q} focusId={`recent:${q}`} className={styles.recentItem} onSelect={() => setQuery(q)}>
                    <Icon name="clock" size="1rem" /> {q}
                  </Focusable>
                ))}
                <Focusable focusId="recent:clear" className={`${styles.recentItem} ${styles.clear}`} onSelect={() => clearRecent(profile.id)}>
                  <Icon name="trash" size="1rem" /> Clear history
                </Focusable>
              </div>
            </FocusSection>
          </section>
        ) : null}
      </div>
      <div className={styles.right} aria-live="polite">
        <Grid
          id="search-results"
          title={hasQuery ? (results.isFetching && !results.data ? 'Searching…' : `Results for “${debounced}”`) : kids ? 'Popular with kids' : 'Popular right now'}
          items={items}
          loading={hasQuery ? results.isLoading : suggestions.isLoading}
          error={hasQuery ? results.isError : suggestions.isError}
          onRetry={() => (hasQuery ? results.refetch() : suggestions.refetch())}
          onSelectItem={open}
          variant={kids ? 'landscape' : 'landscape'}
          empty={
            <div className={styles.noResults}>
              <Icon name="search" size="2rem" />
              <p>No matches for “{debounced}”.</p>
              <p className={styles.tip}>Try a different spelling or fewer words.</p>
            </div>
          }
        />
      </div>
    </div>
  );
}

export default function Search() {
  return <SearchView audience="all" />;
}
