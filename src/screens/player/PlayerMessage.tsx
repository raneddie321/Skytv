import { PillButton } from '@/components/ui';
import { FocusSection, useBackHandler, useScreenFocus } from '@/navigation/react';
import styles from './Player.module.css';

/** Full-screen loading / error state for the player — never a blank screen. */
export function PlayerMessage({
  loading,
  title,
  message,
  onRetry,
  onBack,
}: {
  loading?: boolean;
  title?: string;
  message?: string;
  onRetry?: () => void;
  onBack: () => void;
}) {
  useBackHandler(() => {
    onBack();
    return true;
  });
  useScreenFocus(`player-message:${title ?? 'loading'}`, { defaultId: onRetry ? 'pm:retry' : 'pm:back' });
  return (
    <div className={styles.message} data-testid={loading ? 'player-loading' : 'player-error'}>
      {loading ? <div className={styles.spinner} aria-label="Loading" /> : null}
      {title ? <h1>{title}</h1> : null}
      {message ? <p>{message}</p> : null}
      <FocusSection id="player-message">
        <div className={styles.messageActions}>
          {onRetry ? <PillButton focusId="pm:retry" variant="primary" icon="refresh" label="Try again" onSelect={onRetry} /> : null}
          <PillButton focusId="pm:back" icon="back" label="Back" onSelect={onBack} />
        </div>
      </FocusSection>
    </div>
  );
}
