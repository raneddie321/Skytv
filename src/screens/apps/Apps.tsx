import { useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { Icon, type IconName } from '@/components/Icon';
import { PillButton } from '@/components/ui';
import { FocusSection, Focusable, useScreenFocus } from '@/navigation/react';
import { detectPlatform } from '@/navigation/keymap';
import styles from './Apps.module.css';

/** Configurable app launcher. Real launching is platform-specific (see docs/PLATFORM_PACKAGING.md). */
interface AppDef {
  id: string;
  name: string;
  icon: IconName;
  colors: [string, string];
  description: string;
  /** Platform launch identifiers, supplied by the integrator. */
  launch?: { androidtv?: string; tizen?: string; webos?: string };
}

export const APPS: AppDef[] = [
  { id: 'music', name: 'Music', icon: 'music', colors: ['#ff5f6d', '#ffc371'], description: 'Stream playlists and radio.' },
  { id: 'games', name: 'Games', icon: 'gamepad', colors: ['#7f53ff', '#4ad7ff'], description: 'Casual games playable with the remote.' },
  { id: 'news', name: 'News', icon: 'news', colors: ['#1f4fd8', '#56ccf2'], description: 'Headlines and local news.' },
  { id: 'weather', name: 'Weather', icon: 'sun', colors: ['#f7971e', '#ffd200'], description: 'Forecasts for your area.' },
  { id: 'photos', name: 'Photos', icon: 'photo', colors: ['#11998e', '#38ef7d'], description: 'Your photos on the big screen.' },
  { id: 'fitness', name: 'Fitness', icon: 'fitness', colors: ['#ee0979', '#ff6a00'], description: 'Workouts for the living room.' },
  { id: 'browser', name: 'Web', icon: 'globe', colors: ['#434343', '#8e9eab'], description: 'A TV web browser.' },
  { id: 'settings', name: 'TV settings', icon: 'settings', colors: ['#232526', '#5b6470'], description: 'Picture, sound and network settings of your TV.' },
];

export default function Apps() {
  const [open, setOpen] = useState<AppDef | null>(null);
  const platform = detectPlatform();
  useScreenFocus('apps', { defaultId: `app:${APPS[0].id}` });
  return (
    <div className={styles.page} data-testid="apps">
      <h1 className={styles.heading}>Apps</h1>
      <p className={styles.sub}>Your installed apps. Launching third-party apps requires the native TV platform integration.</p>
      <FocusSection id="apps-grid">
        <div className={styles.grid}>
          {APPS.map((a) => (
            <div key={a.id} data-scroll-anchor>
              <Focusable focusId={`app:${a.id}`} className={styles.tile} onSelect={() => setOpen(a)} aria-label={a.name}>
                <span className={styles.icon} style={{ background: `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]})` }}>
                  <Icon name={a.icon} size="3rem" />
                </span>
                <span className={styles.name}>{a.name}</span>
              </Focusable>
            </div>
          ))}
        </div>
      </FocusSection>
      {open ? (
        <Dialog id="app" title={open.name} onClose={() => setOpen(null)} initialFocus="app:close" width="sm">
          <p className={styles.dialogText}>{open.description}</p>
          <p className={styles.dialogText}>
            {platform === 'browser'
              ? 'App launching isn’t available in the web build. On a TV, this opens the app through the platform launcher.'
              : `No launch identifier is configured for ${open.name} on this device yet.`}
          </p>
          <FocusSection id="app-actions">
            <PillButton focusId="app:close" label="OK" onSelect={() => setOpen(null)} />
          </FocusSection>
        </Dialog>
      ) : null}
    </div>
  );
}
