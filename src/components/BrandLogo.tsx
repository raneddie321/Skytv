import { brand } from '@/config/brand';
import styles from './BrandLogo.module.css';

/** Replaceable brand mark (see src/config/brand.ts). */
export function BrandLogo({ size = 'md', kids = false }: { size?: 'sm' | 'md' | 'lg'; kids?: boolean }) {
  const url = kids ? brand.kidsLogoUrl : brand.logoUrl;
  if (url) return <img src={url} alt={brand.name} className={`${styles.image} ${styles[size]}`} />;
  return (
    <span className={`${styles.wordmark} ${styles[size]}`} aria-label={kids ? `${brand.name} Kids` : brand.name} role="img">
      <span className={styles.main} style={{ backgroundImage: brand.wordmarkGradient }}>
        {brand.wordmark}
      </span>
      {kids ? <span className={styles.kids}>{brand.kidsWordmark}</span> : null}
    </span>
  );
}
