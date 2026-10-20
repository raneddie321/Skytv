import type { TitleStyle } from '@/api/contracts/domain';
import styles from './TitleArt.module.css';

/** Typeset title treatment used over artwork (TMDB backdrops and demo art carry no baked-in titles). */
export function TitleArt({ title, style = 'sans', size = 'md', className }: { title: string; style?: TitleStyle; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  return (
    <span className={`${styles.title} ${styles[style]} ${styles[size]} ${className ?? ''}`} data-length={title.length > 22 ? 'long' : 'short'}>
      {title}
    </span>
  );
}
