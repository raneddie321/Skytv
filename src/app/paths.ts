import type { MediaType, PlaybackContent } from '@/api/contracts/domain';

const enc = encodeURIComponent;

export const paths = {
  profiles: '/profiles',
  newProfile: '/profiles/new',
  editProfile: (id: string) => `/profiles/${enc(id)}/edit`,
  home: '/',
  live: '/live',
  liveGuide: '/live/guide',
  liveNowNext: '/live/now-next',
  tv: '/tv',
  movies: '/movies',
  originals: '/originals',
  apps: '/apps',
  search: '/search',
  watchlist: '/watchlist',
  settings: (section?: string) => (section ? `/settings/${section}` : '/settings'),
  detail: (type: MediaType, id: string) => (type === 'tv' ? `/tv/${enc(id)}` : `/movies/${enc(id)}`),
  kids: '/kids',
  kidsShows: '/kids/shows',
  kidsMovies: '/kids/movies',
  kidsSearch: '/kids/search',
  kidsList: '/kids/list',
  kidsDetail: (type: MediaType, id: string) => `/kids/title/${type}/${enc(id)}`,
  watch: (content: PlaybackContent, opts: { from?: 'start' | 'resume' } = {}) => {
    const q = opts.from === 'start' ? '?from=start' : '';
    switch (content.kind) {
      case 'movie':
        return `/watch/movie/${enc(content.id)}${q}`;
      case 'episode':
        return `/watch/episode/${enc(content.seriesId)}/${content.seasonNumber}/${content.episodeNumber}${q}`;
      case 'channel':
        return `/watch/channel/${enc(content.channelId)}`;
    }
  },
};

export const detailPathFor = (kids: boolean) => (type: MediaType, id: string) =>
  kids ? paths.kidsDetail(type, id) : paths.detail(type, id);
