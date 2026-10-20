import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { Focusable, useActionListener, useIsFocused } from '@/navigation/react';
import styles from './Settings.module.css';

export function ToggleRow({ id, label, description, value, onChange }: { id: string; label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Focusable focusId={id} className={styles.row} role="switch" aria-checked={value} onSelect={() => onChange(!value)} data-testid={id}>
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {description ? <span className={styles.rowDesc}>{description}</span> : null}
      </span>
      <span className={`${styles.switch} ${value ? styles.switchOn : ''}`} />
    </Focusable>
  );
}

/** Cycles through options with OK, or Left/Right while focused. */
export function OptionRow<T extends string>({
  id,
  label,
  description,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const focused = useIsFocused(id);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const step = (d: number) => onChange(options[(idx + d + options.length) % options.length].value);
  useActionListener((e) => {
    if (e.action === 'left' || e.action === 'right') {
      step(e.action === 'left' ? -1 : 1);
      return true;
    }
    return false;
  }, focused);
  return (
    <Focusable focusId={id} className={styles.row} onSelect={() => step(1)} aria-label={`${label}: ${options[idx]?.label}`} data-testid={id}>
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {description ? <span className={styles.rowDesc}>{description}</span> : null}
      </span>
      <span className={styles.option}>
        <Icon name="chevronLeft" size="1rem" />
        <span>{options[idx]?.label}</span>
        <Icon name="chevronRight" size="1rem" />
      </span>
    </Focusable>
  );
}

export function ActionRow({ id, label, description, value, onSelect, icon = 'chevronRight' }: { id: string; label: string; description?: string; value?: ReactNode; onSelect: () => void; icon?: 'chevronRight' | 'edit' | 'refresh' | 'exit' | 'lock' | 'plus' }) {
  return (
    <Focusable focusId={id} className={styles.row} onSelect={onSelect} data-testid={id}>
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {description ? <span className={styles.rowDesc}>{description}</span> : null}
      </span>
      <span className={styles.rowValue}>
        {value}
        <Icon name={icon} size="1.1rem" />
      </span>
    </Focusable>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  );
}
