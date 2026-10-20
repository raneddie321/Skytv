import { FocusSection, Focusable } from '@/navigation/react';
import { Icon } from './Icon';
import styles from './OnScreenKeyboard.module.css';

const ALPHA = 'abcdefghijklmnopqrstuvwxyz1234567890'.split('');

/**
 * TV-friendly on-screen keyboard (6-column grid + action row). Physical keyboards are handled by the screen
 * via useActionListener so both input methods work at once.
 */
export function OnScreenKeyboard({
  id = 'osk',
  onChar,
  onDelete,
  onClear,
  columns = 6,
  size = 'md',
}: {
  id?: string;
  onChar: (c: string) => void;
  onDelete: () => void;
  onClear: () => void;
  columns?: number;
  size?: 'md' | 'lg';
}) {
  return (
    <FocusSection id={id}>
      <div className={`${styles.kb} ${styles[size]}`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }} data-testid="osk">
        {ALPHA.map((c) => (
          <Focusable key={c} focusId={`${id}:${c}`} className={styles.key} onSelect={() => onChar(c)} aria-label={c}>
            {c}
          </Focusable>
        ))}
        <Focusable focusId={`${id}:space`} className={`${styles.key} ${styles.wide}`} style={{ gridColumn: `span ${Math.ceil(columns / 3)}` }} onSelect={() => onChar(' ')} aria-label="Space">
          <Icon name="space" />
        </Focusable>
        <Focusable focusId={`${id}:del`} className={`${styles.key} ${styles.wide}`} style={{ gridColumn: `span ${Math.ceil(columns / 3)}` }} onSelect={onDelete} aria-label="Delete">
          <Icon name="backspace" />
        </Focusable>
        <Focusable focusId={`${id}:clear`} className={`${styles.key} ${styles.wide}`} style={{ gridColumn: `span ${columns - 2 * Math.ceil(columns / 3)}` }} onSelect={onClear} aria-label="Clear">
          Clear
        </Focusable>
      </div>
    </FocusSection>
  );
}
