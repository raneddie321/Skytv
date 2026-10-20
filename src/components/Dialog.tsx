import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FocusLayer, useBackHandler } from '@/navigation/react';
import styles from './Dialog.module.css';

/** Modal dialog with its own focus layer. Back closes it. */
export function Dialog({
  id,
  title,
  children,
  onClose,
  initialFocus,
  width = 'md',
  light,
}: {
  id: string;
  title?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  initialFocus?: string;
  width?: 'sm' | 'md' | 'lg';
  light?: boolean;
}) {
  useBackHandler(() => {
    onClose();
    return true;
  });
  return createPortal(
    <div className={`${styles.overlay} ${light ? 'theme-kids' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} data-testid={`dialog-${id}`}>
      <FocusLayer id={`dialog:${id}`} initialFocus={initialFocus}>
        <div className={`${styles.panel} ${styles[width]}`}>
          {title ? <h2 className={styles.title}>{title}</h2> : null}
          {children}
        </div>
      </FocusLayer>
    </div>,
    document.body,
  );
}
