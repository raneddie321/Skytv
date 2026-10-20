import type { CastMember } from '@/api/contracts/domain';
import { Focusable } from '@/navigation/react';
import { Img } from './Img';
import { Rail } from './Rail';
import styles from './CastRow.module.css';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export function CastRow({ id, cast }: { id: string; cast: CastMember[] }) {
  if (!cast.length) return null;
  return (
    <Rail id={id} title="Cast">
      {cast.slice(0, 14).map((c) => (
        <Focusable key={c.id} focusId={`${id}:${c.id}`} className={styles.person} aria-label={`${c.name}${c.character ? ` as ${c.character}` : ''}`}>
          <span className={styles.photo}>
            {c.profileUrl ? <Img src={c.profileUrl} alt="" width={120} /> : <span className={styles.initials}>{initials(c.name)}</span>}
          </span>
          <span className={styles.name}>{c.name}</span>
          {c.character ? <span className={styles.role}>{c.character}</span> : null}
        </Focusable>
      ))}
    </Rail>
  );
}
