import type { Channel } from '@/api/contracts/domain';
import { channelLogoStyle } from '@/api/fixtures/live';
import styles from './ChannelLogo.module.css';

/** Channel logo: uses `logoUrl` when the backend supplies one, otherwise a generated wordmark for demo channels. */
export function ChannelLogo({ channel, size = 'md' }: { channel: Pick<Channel, 'id' | 'name' | 'logoUrl'>; size?: 'sm' | 'md' | 'lg' }) {
  if (channel.logoUrl) return <img className={`${styles.img} ${styles[size]}`} src={channel.logoUrl} alt={channel.name} />;
  const style = channelLogoStyle(channel.id) ?? { color: '#ffffff', mark: 'circle' as const };
  const words = channel.name.split(' ');
  const main = words[0];
  const rest = words.slice(1).join(' ');
  return (
    <span className={`${styles.logo} ${styles[size]}`} role="img" aria-label={channel.name}>
      <span className={`${styles.mark} ${styles[style.mark]}`} style={{ background: style.color }} />
      <span className={styles.text}>
        <span className={styles.main}>{main}</span>
        {rest ? <span className={styles.rest}>{rest}</span> : null}
      </span>
    </span>
  );
}
