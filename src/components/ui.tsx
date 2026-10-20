import type { ReactNode } from 'react';
import { Focusable } from '@/navigation/react';
import { Icon, type IconName } from './Icon';
import styles from './ui.module.css';

export function PillButton({
  focusId,
  label,
  icon,
  onSelect,
  variant = 'secondary',
  size = 'md',
  disabled,
  className,
  ariaLabel,
}: {
  focusId: string;
  label?: ReactNode;
  icon?: IconName;
  onSelect?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Focusable
      focusId={focusId}
      onSelect={onSelect}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${styles.pill} ${styles[variant]} ${styles[size]} ${label ? '' : styles.iconOnly} ${className ?? ''}`}
    >
      {icon ? <Icon name={icon} size="1.15em" /> : null}
      {label ? <span>{label}</span> : null}
    </Focusable>
  );
}

export function ProgressBar({ value, className, live }: { value: number; className?: string; live?: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={`${styles.progress} ${live ? styles.live : ''} ${className ?? ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`${styles.skeleton} ${className ?? ''}`} style={style} aria-hidden="true" />;
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'live' | 'new' | 'outline' }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We couldn’t load this content. Check your connection and try again.',
  onRetry,
  focusId = 'error-retry',
  compact,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  focusId?: string;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.error} ${compact ? styles.errorCompact : ''}`} role="alert">
      <Icon name="wifi" size="2.2rem" />
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
      {onRetry ? <PillButton focusId={focusId} icon="refresh" label="Try again" onSelect={onRetry} /> : null}
    </div>
  );
}

export function SampleNotice({ children }: { children: ReactNode }) {
  return (
    <div className={styles.notice}>
      <Icon name="info" size="1.1em" />
      <span>{children}</span>
    </div>
  );
}

export function formatRuntime(minutes?: number): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m ? `${m}m` : ''}`.trim() : `${m}m`;
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return h ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}
