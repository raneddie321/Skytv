import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { EpisodeRef, MediaRef, PlaybackContent, Programme } from '@/api/contracts/domain';
import { getServices } from '@/api';
import { scheduleWindow, useChannels, useMovie, useSchedule, useSeason, useSeries } from '@/api/hooks';
import { PinDialog } from '@/components/PinPad';
import { paths } from '@/app/paths';
import { episodeProgressKey, movieProgressKey, toMediaRef, useProfileLibrary } from '@/state/library';
import { useActiveProfile } from '@/state/profiles';
import { useSettings } from '@/state/settings';
import { PlayerView, type PlayerItem } from './PlayerView';
import { PlayerMessage } from './PlayerMessage';

export function parseContent(kind: string | undefined, rest: string | undefined): PlaybackContent | null {
  const parts = (rest ?? '').split('/').filter(Boolean).map(decodeURIComponent);
  if (kind === 'movie' && parts[0]) return { kind: 'movie', id: parts[0] };
  if (kind === 'channel' && parts[0]) return { kind: 'channel', channelId: parts[0] };
  if (kind === 'episode' && parts.length >= 3) {
    const s = Number(parts[1]);
    const e = Number(parts[2]);
    if (Number.isInteger(s) && Number.isInteger(e)) return { kind: 'episode', seriesId: parts[0], seasonNumber: s, episodeNumber: e };
  }
  return null;
}

const toEpisodeRef = (e: { id: string; seasonNumber: number; episodeNumber: number; title: string; stillUrl?: string; runtimeMinutes?: number }): EpisodeRef => ({
  id: e.id,
  seasonNumber: e.seasonNumber,
  episodeNumber: e.episodeNumber,
  title: e.title,
  stillUrl: e.stillUrl,
  runtimeMinutes: e.runtimeMinutes,
});

/** Resolves display metadata, next-episode information and live programme data for the player. */
function usePlayerItem(content: PlaybackContent): { item?: PlayerItem; loading: boolean; error: boolean } {
  const movie = useMovie(content.kind === 'movie' ? content.id : undefined);
  const series = useSeries(content.kind === 'episode' ? content.seriesId : undefined);
  const season = useSeason(content.kind === 'episode' ? content.seriesId : undefined, content.kind === 'episode' ? content.seasonNumber : undefined);
  const seasons = series.data?.seasons ?? [];
  const seasonIdx = content.kind === 'episode' ? seasons.findIndex((s) => s.seasonNumber === content.seasonNumber) : -1;
  const episodes = season.data && content.kind === 'episode' && season.data.seasonNumber === content.seasonNumber ? season.data.episodes : undefined;
  const isLastInSeason = !!episodes && content.kind === 'episode' && episodes[episodes.length - 1]?.episodeNumber === content.episodeNumber;
  const nextSeasonNumber = isLastInSeason && seasonIdx >= 0 ? seasons[seasonIdx + 1]?.seasonNumber : undefined;
  const nextSeason = useSeason(content.kind === 'episode' && nextSeasonNumber ? content.seriesId : undefined, nextSeasonNumber);

  const channels = useChannels();
  const range = useMemo(() => scheduleWindow(1, 3), []);
  const schedule = useSchedule(content.kind === 'channel' ? [content.channelId] : undefined, range.from, range.to);

  return useMemo(() => {
    if (content.kind === 'movie') {
      if (movie.isError) return { loading: false, error: true };
      const m = movie.data;
      if (!m) return { loading: true, error: false };
      return {
        loading: false,
        error: false,
        item: {
          key: movieProgressKey(m.id),
          title: m.title,
          subtitle: [m.year, m.certification].filter(Boolean).join(' · '),
          media: toMediaRef(m),
          certification: m.certification,
          kidsSafe: m.kidsSafe,
          backPath: paths.detail('movie', m.id),
        },
      };
    }
    if (content.kind === 'episode') {
      if (series.isError || season.isError) return { loading: false, error: true };
      const s = series.data;
      if (!s || !episodes) return { loading: true, error: false };
      const idx = episodes.findIndex((e) => e.episodeNumber === content.episodeNumber);
      const ep = episodes[idx];
      if (!ep) return { loading: false, error: true };
      const nextInSeason = episodes[idx + 1];
      const nextFromSeason = nextSeason.data?.episodes[0];
      const next = nextInSeason ?? nextFromSeason;
      return {
        loading: false,
        error: false,
        item: {
          key: episodeProgressKey(s.id, ep.seasonNumber, ep.episodeNumber),
          title: s.title,
          subtitle: `S${ep.seasonNumber} E${ep.episodeNumber} · ${ep.title}`,
          media: toMediaRef(s) as MediaRef,
          episode: toEpisodeRef(ep),
          nextEpisode: next ? toEpisodeRef(next) : undefined,
          certification: s.certification,
          kidsSafe: s.kidsSafe,
          backPath: paths.detail('tv', s.id),
        },
      };
    }
    const channel = channels.data?.find((c) => c.id === content.channelId);
    if (channels.isError || (channels.data && !channel)) return { loading: false, error: true };
    if (!channel) return { loading: true, error: false };
    const now = Date.now();
    const list: Programme[] = schedule.data?.[channel.id] ?? [];
    const current = list.find((p) => Date.parse(p.start) <= now && Date.parse(p.end) > now);
    const next = current ? list.find((p) => p.start === current.end) : undefined;
    const sorted = [...channels.data!].sort((a, b) => a.number - b.number);
    const i = sorted.findIndex((c) => c.id === channel.id);
    return {
      loading: false,
      error: false,
      item: {
        key: `channel:${channel.id}`,
        title: current?.title ?? channel.name,
        subtitle: `${channel.number} ${channel.name}`,
        live: {
          channel,
          programme: current,
          next,
          prevChannelId: sorted[(i - 1 + sorted.length) % sorted.length].id,
          nextChannelId: sorted[(i + 1) % sorted.length].id,
        },
        certification: current?.certification,
        kidsSafe: channel.category === 'kids',
        backPath: paths.live,
      },
    };
  }, [content, movie.data, movie.isError, series.data, series.isError, season.isError, episodes, nextSeason.data, channels.data, channels.isError, schedule.data]);
}

function PlayerContainer({ content }: { content: PlaybackContent }) {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const profile = useActiveProfile()!;
  const library = useProfileLibrary(profile.id);
  const parental = useSettings((s) => s.parental);
  const { item, loading, error } = usePlayerItem(content);
  const [pinOk, setPinOk] = useState(false);

  const session = useQuery({
    queryKey: ['playback-session', profile.id, content],
    queryFn: async () => {
      const services = getServices();
      const entitlement = await services.entitlements.check(profile.id, content);
      if (!entitlement.entitled) throw Object.assign(new Error('not_entitled'), { entitlement });
      return services.playback.createSession(profile.id, content);
    },
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });

  const exit = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(item?.backPath ?? (profile.kind === 'kids' ? paths.kids : paths.home), { replace: true });
  };

  if (error || session.isError) {
    const notEntitled = (session.error as { entitlement?: unknown } | null)?.entitlement;
    return (
      <PlayerMessage
        title={notEntitled ? 'Not included in your subscription' : 'This can’t be played right now'}
        message={notEntitled ? 'Upgrade your plan to watch this.' : 'The stream or its details couldn’t be loaded. Please try again.'}
        onRetry={notEntitled ? undefined : () => session.refetch()}
        onBack={exit}
      />
    );
  }
  if (loading || !item || session.isLoading || !session.data) return <PlayerMessage loading onBack={exit} />;

  // Kids profiles only play titles flagged as kids-safe by the catalog (not a complete safety solution).
  if (profile.kind === 'kids' && item.kidsSafe === false) {
    return <PlayerMessage title="Not available in Kids" message="Ask a grown-up to switch profile." onBack={exit} />;
  }
  // Optional PIN for 18-certified titles on adult profiles.
  if (profile.kind === 'adult' && parental.pinFor18 && item.certification === '18' && !pinOk) {
    return (
      <>
        <PlayerMessage loading onBack={exit} />
        <PinDialog title="Rated 18" message="Enter the parent PIN to watch this title." onSuccess={() => setPinOk(true)} onClose={exit} />
      </>
    );
  }

  const record = library.progress[item.key];
  const fromStart = search.get('from') === 'start';
  const startAt = !content || content.kind === 'channel' || fromStart || !record || record.completed ? 0 : record.positionSec;

  return (
    <PlayerView
      item={item}
      session={session.data}
      startAt={startAt}
      profileId={profile.id}
      onExit={exit}
      onPlayNext={(e) => {
        if (content.kind !== 'episode') return;
        navigate(paths.watch({ kind: 'episode', seriesId: content.seriesId, seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber }), { replace: true });
      }}
      onChangeChannel={(channelId) => navigate(paths.watch({ kind: 'channel', channelId }), { replace: true })}
    />
  );
}

export default function Player() {
  const params = useParams();
  const content = useMemo(() => parseContent(params.kind, params['*']), [params]);
  const navigate = useNavigate();
  if (!content) {
    return <PlayerMessage title="Unknown content" message="This link doesn’t point to anything playable." onBack={() => navigate(paths.home)} />;
  }
  return <PlayerContainer key={JSON.stringify(content)} content={content} />;
}
