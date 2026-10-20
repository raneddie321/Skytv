import { useState } from 'react';
import { FocusSection, Focusable, useActionListener } from '@/navigation/react';
import { getServices } from '@/api';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import styles from './PinPad.module.css';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'] as const;

/** Parental PIN entry. Digits can be entered with the remote's number keys or the on-screen keypad. */
export function PinDialog({
  title = 'Enter parent PIN',
  message = 'A parent PIN is required to continue.',
  onSuccess,
  onClose,
  light,
}: {
  title?: string;
  message?: string;
  onSuccess: () => void;
  onClose: () => void;
  light?: boolean;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const push = async (digit: string) => {
    if (checking) return;
    setError(false);
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      setChecking(true);
      const ok = await getServices().parental.verifyPin(next).catch(() => false);
      setChecking(false);
      if (ok) onSuccess();
      else {
        setError(true);
        setPin('');
      }
    }
  };

  useActionListener((e) => {
    if (e.digit !== undefined) {
      void push(String(e.digit));
      return true;
    }
    if (e.backspace) {
      setPin((p) => p.slice(0, -1));
      return true;
    }
    return false;
  });

  return (
    <Dialog id="pin" title={title} onClose={onClose} initialFocus="pin:1" width="sm" light={light}>
      <p className={styles.message}>{message}</p>
      <div className={`${styles.dots} ${error ? styles.shake : ''}`} aria-label={`${pin.length} of 4 digits entered`} data-testid="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? styles.filled : ''} />
        ))}
      </div>
      <p className={styles.error} role="alert">
        {error ? 'Incorrect PIN. Try again.' : ' '}
      </p>
      <FocusSection id="pin-keys">
        <div className={styles.grid}>
          {KEYS.map((k) => (
            <Focusable
              key={k}
              focusId={`pin:${k}`}
              className={styles.key}
              aria-label={k === 'del' ? 'Delete' : k === 'clear' ? 'Clear' : k}
              onSelect={() => {
                if (k === 'del') setPin((p) => p.slice(0, -1));
                else if (k === 'clear') setPin('');
                else void push(k);
              }}
            >
              {k === 'del' ? <Icon name="backspace" /> : k === 'clear' ? 'Clear' : k}
            </Focusable>
          ))}
        </div>
      </FocusSection>
      <p className={styles.hint}>Demo PIN: 1234 (change it in Settings › Parental controls)</p>
    </Dialog>
  );
}
