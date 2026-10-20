/** Profile avatars. Generated locally by scripts/demo-art; replace the files in public/demo-art/avatars to rebrand. */
export interface AvatarDef {
  id: string;
  label: string;
  palette: [string, string, string];
  creature?: string;
  kids?: boolean;
}

export const AVATARS: AvatarDef[] = [
  { id: 'dusk', label: 'Dusk', palette: ['#3b1d3a', '#d9774a', '#ffd18a'] },
  { id: 'ocean', label: 'Ocean', palette: ['#0b2342', '#2d7fb8', '#9fe2ff'] },
  { id: 'forest', label: 'Forest', palette: ['#0e2a22', '#3f8a63', '#c8f7c5'] },
  { id: 'berry', label: 'Berry', palette: ['#2a0f2f', '#a33a6d', '#ffb3d1'] },
  { id: 'gold', label: 'Gold', palette: ['#2e1f0a', '#c08a2b', '#fff0b3'] },
  { id: 'slate', label: 'Slate', palette: ['#121722', '#4b5b78', '#d6e2ff'] },
  { id: 'ember', label: 'Ember', palette: ['#250c0a', '#c2412c', '#ffc07a'] },
  { id: 'violet', label: 'Violet', palette: ['#160f33', '#6046c9', '#d7c9ff'] },
  { id: 'kids-bloop', label: 'Bloop', palette: ['#5b8cff', '#b48cff', '#ffe58a'], creature: '#8fb8ff', kids: true },
  { id: 'kids-fizz', label: 'Fizz', palette: ['#ff7eb6', '#ffc078', '#fff3b0'], creature: '#ff9ac6', kids: true },
  { id: 'kids-moss', label: 'Moss', palette: ['#38d9a9', '#a9e34b', '#fffbe0'], creature: '#69db7c', kids: true },
  { id: 'kids-sunny', label: 'Sunny', palette: ['#ffa94d', '#ffd43b', '#ffffff'], creature: '#ffd43b', kids: true },
];

export const avatarUrl = (id: string) => `/demo-art/avatars/${AVATARS.some((a) => a.id === id) ? id : 'slate'}.webp`;
