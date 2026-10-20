/**
 * Configuration-driven "Sky Originals" curation.
 * The "original" badge is ONLY shown for titles listed here — it is never inferred from TMDB metadata.
 * In production this list should come from an authoritative catalog feed (see docs/BACKEND_INTEGRATION.md).
 */
import type { CollectionEntry } from '@/api/contracts/services';

export interface OriginalsCollection {
  id: string;
  title: string;
  entries: CollectionEntry[];
}

export interface OriginalsConfig {
  featured: CollectionEntry[];
  collections: OriginalsCollection[];
}

/** Offline demo catalog: fictional "demo originals". */
const fixtures: OriginalsConfig = {
  featured: [{ id: 'demo:tv:kingsgate' }, { id: 'demo:tv:iron-meridian' }, { id: 'demo:tv:the-harbourmaster' }],
  collections: [
    {
      id: 'new',
      title: 'New Originals',
      entries: [
        { id: 'demo:tv:the-harbourmaster' },
        { id: 'demo:tv:kingsgate' },
        { id: 'demo:tv:the-last-embassy' },
        { id: 'demo:tv:matchday' },
        { id: 'demo:tv:blue-hour' },
      ],
    },
    {
      id: 'drama',
      title: 'Award-winning drama',
      entries: [
        { id: 'demo:tv:northbound' },
        { id: 'demo:tv:highland-line' },
        { id: 'demo:tv:iron-meridian' },
        { id: 'demo:tv:hollow-pines' },
      ],
    },
    {
      id: 'comedy',
      title: 'Comedy & feel-good',
      entries: [{ id: 'demo:tv:saltmarsh' }, { id: 'demo:tv:blue-hour' }],
    },
    {
      id: 'films',
      title: 'Original films',
      entries: [{ id: 'demo:movie:ember-city' }, { id: 'demo:movie:solar-drift' }, { id: 'demo:movie:paper-moons' }],
    },
  ],
};

/**
 * TMDB mode: editorial list of Sky-commissioned series, resolved by exact title (+ year) through TMDB search.
 * Entries that cannot be matched exactly are skipped. Review against an authoritative source before release.
 */
const tmdb: OriginalsConfig = {
  featured: [
    { lookup: { type: 'tv', title: 'Gangs of London', year: 2020 } },
    { lookup: { type: 'tv', title: 'The Day of the Jackal', year: 2024 } },
    { lookup: { type: 'tv', title: 'A Discovery of Witches', year: 2018 } },
  ],
  collections: [
    {
      id: 'drama',
      title: 'Sky Original drama',
      entries: [
        { lookup: { type: 'tv', title: 'Gangs of London', year: 2020 } },
        { lookup: { type: 'tv', title: 'The Day of the Jackal', year: 2024 } },
        { lookup: { type: 'tv', title: 'The Lazarus Project', year: 2022 } },
        { lookup: { type: 'tv', title: 'Then You Run', year: 2023 } },
        { lookup: { type: 'tv', title: 'Funny Woman', year: 2023 } },
      ],
    },
    {
      id: 'fantasy',
      title: 'Fantasy & sci-fi',
      entries: [
        { lookup: { type: 'tv', title: 'A Discovery of Witches', year: 2018 } },
        { lookup: { type: 'tv', title: 'Intergalactic', year: 2021 } },
        { lookup: { type: 'tv', title: 'Temple', year: 2019 } },
      ],
    },
    {
      id: 'comedy',
      title: 'Comedy',
      entries: [{ lookup: { type: 'tv', title: 'Brassic', year: 2019 } }],
    },
  ],
};

export const originalsConfig = { fixtures, tmdb };

/** Ids that may display the "original" badge (resolved ids are registered at runtime for TMDB lookups). */
const originalIds = new Set<string>(
  [...fixtures.featured, ...fixtures.collections.flatMap((c) => c.entries)].flatMap((e) => ('id' in e ? [e.id] : [])),
);
export const registerOriginalIds = (ids: string[]) => ids.forEach((id) => originalIds.add(id));
export const isOriginal = (id: string) => originalIds.has(id);
