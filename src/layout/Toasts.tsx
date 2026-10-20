import { Icon } from '@/components/Icon';
import { useToasts } from '@/state/toasts';
import styles from './Toasts.module.css';

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className={styles.stack} aria-live="polite" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast}>
          <Icon name={t.icon ?? 'check'} size="1.2rem" />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
