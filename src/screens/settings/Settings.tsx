import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getServices } from '@/api';
import { useAccount, useSubscription } from '@/api/hooks';
import { RoutedCatalog } from '@/api/routedCatalog';
import { Dialog } from '@/components/Dialog';
import { Icon, type IconName } from '@/components/Icon';
import { Img } from '@/components/Img';
import { PinDialog } from '@/components/PinPad';
import { Badge, PillButton } from '@/components/ui';
import { paths } from '@/app/paths';
import { appConfig } from '@/config/env';
import { avatarUrl } from '@/config/avatars';
import { brand } from '@/config/brand';
import { FocusSection, Focusable, useFocusManager, useScreenFocus } from '@/navigation/react';
import { detectPlatform } from '@/navigation/keymap';
import { useCatalogStatus } from '@/state/catalogStatus';
import { useParentalSession } from '@/state/parentalSession';
import { useActiveProfile, useProfiles } from '@/state/profiles';
import { useSettings } from '@/state/settings';
import { toast } from '@/state/toasts';
import { ActionRow, InfoRow, OptionRow, ToggleRow } from './SettingRows';
import styles from './Settings.module.css';

type Section = 'profiles' | 'language' | 'subtitles' | 'playback' | 'accessibility' | 'parental' | 'account' | 'network' | 'about';

const SECTIONS: { id: Section; label: string; icon: IconName }[] = [
  { id: 'profiles', label: 'Profiles', icon: 'user' },
  { id: 'language', label: 'Language', icon: 'globe' },
  { id: 'subtitles', label: 'Subtitles', icon: 'subtitles' },
  { id: 'playback', label: 'Playback', icon: 'play' },
  { id: 'accessibility', label: 'Accessibility', icon: 'accessibility' },
  { id: 'parental', label: 'Parental controls', icon: 'shield' },
  { id: 'account', label: 'Account', icon: 'card' },
  { id: 'network', label: 'Network diagnostics', icon: 'wifi' },
  { id: 'about', label: 'App information', icon: 'info' },
];

export default function Settings() {
  const { section: param } = useParams();
  const section = (SECTIONS.find((s) => s.id === param)?.id ?? 'profiles') as Section;
  const navigate = useNavigate();
  const unlocked = useParentalSession((s) => s.unlocked);
  const unlock = useParentalSession((s) => s.unlock);
  const [pinFor, setPinFor] = useState<Section | null>(null);
  const manager = useFocusManager();
  useScreenFocus('settings', { defaultId: `settings-menu:${section}` });

  const open = (id: Section) => {
    if (id === 'parental' && !unlocked) {
      setPinFor(id);
      return;
    }
    navigate(paths.settings(id), { replace: true });
    requestAnimationFrame(() => manager.focusSection('settings-pane'));
  };

  return (
    <div className={styles.page} data-testid="settings">
      <h1 className={styles.heading}>Settings</h1>
      <div className={styles.layout}>
        <FocusSection id="settings-menu" enterTo="last">
          <nav className={styles.menu} aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <Focusable
                key={s.id}
                focusId={`settings-menu:${s.id}`}
                className={`${styles.menuItem} ${s.id === section ? styles.menuActive : ''}`}
                aria-current={s.id === section ? 'page' : undefined}
                onSelect={() => open(s.id)}
                data-testid={`settings-${s.id}`}
              >
                <Icon name={s.icon} size="1.2rem" />
                <span>{s.label}</span>
                {s.id === 'parental' && !unlocked ? <Icon name="lock" size="1rem" className={styles.lock} /> : null}
              </Focusable>
            ))}
          </nav>
        </FocusSection>
        <FocusSection id="settings-pane" enterTo="first">
          <section className={styles.pane} aria-label={SECTIONS.find((s) => s.id === section)?.label}>
            <h2 className={styles.paneTitle}>{SECTIONS.find((s) => s.id === section)?.label}</h2>
            {section === 'parental' && !unlocked ? (
              <div className={styles.locked}>
                <Icon name="lock" size="2rem" />
                <p>Parental controls are protected by the parent PIN.</p>
                <PillButton focusId="parental:unlock" variant="primary" label="Enter PIN" onSelect={() => setPinFor('parental')} />
              </div>
            ) : (
              <SectionContent section={section} />
            )}
          </section>
        </FocusSection>
      </div>
      {pinFor ? (
        <PinDialog
          title="Parental controls"
          message="Enter the parent PIN to change restricted settings."
          onClose={() => setPinFor(null)}
          onSuccess={() => {
            unlock();
            setPinFor(null);
            navigate(paths.settings(pinFor), { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}

function SectionContent({ section }: { section: Section }) {
  switch (section) {
    case 'profiles':
      return <ProfilesSection />;
    case 'language':
      return <LanguageSection />;
    case 'subtitles':
      return <SubtitlesSection />;
    case 'playback':
      return <PlaybackSection />;
    case 'accessibility':
      return <AccessibilitySection />;
    case 'parental':
      return <ParentalSection />;
    case 'account':
      return <AccountSection />;
    case 'network':
      return <NetworkSection />;
    case 'about':
      return <AboutSection />;
  }
}

function ProfilesSection() {
  const navigate = useNavigate();
  const profiles = useProfiles((s) => s.profiles);
  const active = useActiveProfile();
  return (
    <div className={styles.list}>
      {profiles.map((p) => (
        <ActionRow
          key={p.id}
          id={`settings-profile:${p.id}`}
          icon="edit"
          label={p.name}
          description={`${p.kind === 'kids' ? 'Kids profile' : 'Standard profile'}${p.id === active?.id ? ' · Watching now' : ''}`}
          value={
            <span className={styles.miniAvatar}>
              <Img src={avatarUrl(p.avatarId)} alt="" width={60} />
            </span>
          }
          onSelect={() => navigate(paths.editProfile(p.id))}
        />
      ))}
      <ActionRow id="settings-profile:add" icon="plus" label="Add profile" onSelect={() => navigate(paths.newProfile)} />
      <ActionRow id="settings-profile:switch" icon="exit" label="Switch profile" onSelect={() => navigate(paths.profiles)} />
    </div>
  );
}

function LanguageSection() {
  const audio = useSettings((s) => s.audioLanguage);
  const setAudio = useSettings((s) => s.setAudioLanguage);
  const subtitles = useSettings((s) => s.subtitles);
  const update = useSettings((s) => s.update);
  return (
    <div className={styles.list}>
      <InfoRow label="App language" value="English (UK)" />
      <OptionRow id="lang:audio" label="Preferred audio" value={audio} options={[{ value: 'en', label: 'English' }, { value: 'original', label: 'Original language' }]} onChange={setAudio} />
      <OptionRow id="lang:subs" label="Subtitle language" value={subtitles.language} options={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }]} onChange={(language) => update('subtitles', { language })} />
      <p className={styles.note}>Additional interface languages can be added through the string catalog; all interface text is currently English.</p>
    </div>
  );
}

function SubtitlesSection() {
  const s = useSettings((x) => x.subtitles);
  const update = useSettings((x) => x.update);
  return (
    <div className={styles.list}>
      <ToggleRow id="subs:enabled" label="Subtitles" description="Show subtitles when available" value={s.enabled} onChange={(enabled) => update('subtitles', { enabled })} />
      <OptionRow id="subs:size" label="Text size" value={s.size} options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]} onChange={(size) => update('subtitles', { size })} />
      <ToggleRow id="subs:bg" label="Background box" description="Improves readability on bright scenes" value={s.background} onChange={(background) => update('subtitles', { background })} />
      <div className={`${styles.subsPreview} ${styles[`subs_${s.size}`]} ${s.background ? styles.subsBg : ''}`}>
        <span>This is how subtitles will look.</span>
      </div>
    </div>
  );
}

function PlaybackSection() {
  const p = useSettings((x) => x.playback);
  const update = useSettings((x) => x.update);
  return (
    <div className={styles.list}>
      <ToggleRow id="pb:autoplay" label="Autoplay next episode" value={p.autoplayNext} onChange={(autoplayNext) => update('playback', { autoplayNext })} />
      <ToggleRow id="pb:previews" label="Autoplay previews" description="Rotate featured titles on Home" value={p.autoplayPreviews} onChange={(autoplayPreviews) => update('playback', { autoplayPreviews })} />
      <OptionRow
        id="pb:stream"
        label="Stream format"
        description="Auto picks HLS where supported, otherwise progressive"
        value={p.preferredStream}
        options={[{ value: 'auto', label: 'Auto' }, { value: 'hls', label: 'Prefer HLS' }, { value: 'progressive', label: 'Prefer progressive' }]}
        onChange={(preferredStream) => update('playback', { preferredStream })}
      />
      <ToggleRow id="pb:datasaver" label="Data saver" description="Request lower bitrates on metered connections" value={p.dataSaver} onChange={(dataSaver) => update('playback', { dataSaver })} />
    </div>
  );
}

function AccessibilitySection() {
  const a = useSettings((x) => x.accessibility);
  const update = useSettings((x) => x.update);
  return (
    <div className={styles.list}>
      <OptionRow
        id="a11y:motion"
        label="Reduce motion"
        description="Disables animated transitions and smooth scrolling"
        value={a.reduceMotion}
        options={[{ value: 'system', label: 'Follow system' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
        onChange={(reduceMotion) => update('accessibility', { reduceMotion })}
      />
      <ToggleRow id="a11y:contrast" label="High-contrast focus" description="Thicker focus outline and brighter secondary text" value={a.highContrast} onChange={(highContrast) => update('accessibility', { highContrast })} />
      <ToggleRow id="a11y:text" label="Larger text" value={a.largeText} onChange={(largeText) => update('accessibility', { largeText })} />
    </div>
  );
}

function ParentalSection() {
  const p = useSettings((x) => x.parental);
  const update = useSettings((x) => x.update);
  const [changing, setChanging] = useState<'current' | 'new' | null>(null);
  const [current, setCurrent] = useState('');
  return (
    <div className={styles.list}>
      <OptionRow id="parental:kids" label="Kids profile limit" description="Highest certification shown on Kids profiles" value={p.kidsMaxCertification} options={[{ value: 'U', label: 'U only' }, { value: 'PG', label: 'Up to PG' }]} onChange={(kidsMaxCertification) => update('parental', { kidsMaxCertification })} />
      <ToggleRow id="parental:18" label="PIN for 18-rated titles" description="Ask for the PIN before playing 18 certificate content" value={p.pinFor18} onChange={(pinFor18) => update('parental', { pinFor18 })} />
      <ActionRow id="parental:pin" icon="lock" label="Change PIN" onSelect={() => setChanging('current')} />
      <p className={styles.note}>
        Age filtering relies on catalog metadata and is not a complete child-safety solution. Production builds must enforce
        ratings and PIN checks server-side.
      </p>
      {changing === 'current' ? (
        <PinDialog
          title="Current PIN"
          message="Enter the current PIN."
          onClose={() => setChanging(null)}
          onSuccess={(pin) => {
            setCurrent(pin);
            setChanging('new');
          }}
        />
      ) : null}
      {changing === 'new' ? (
        <NewPinDialog
          onClose={() => setChanging(null)}
          onDone={async (pin) => {
            const ok = await getServices().parental.changePin(current, pin);
            setCurrent('');
            setChanging(null);
            toast(ok ? 'PIN updated' : 'Couldn’t change PIN', ok ? 'check' : 'info');
          }}
        />
      ) : null}
    </div>
  );
}

function NewPinDialog({ onClose, onDone }: { onClose: () => void; onDone: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  return (
    <Dialog id="new-pin" title="New PIN" onClose={onClose} initialFocus="newpin:1" width="sm">
      <p className={styles.note}>Choose a new 4-digit PIN.</p>
      <div className={styles.pinDots}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? styles.pinFilled : ''} />
        ))}
      </div>
      <FocusSection id="newpin-keys">
        <div className={styles.pinGrid}>
          {keys.map((k) => (
            <Focusable
              key={k}
              focusId={`newpin:${k}`}
              className={styles.pinKey}
              onSelect={() => {
                const next = (pin + k).slice(0, 4);
                setPin(next);
                if (next.length === 4) onDone(next);
              }}
            >
              {k}
            </Focusable>
          ))}
        </div>
      </FocusSection>
    </Dialog>
  );
}

function AccountSection() {
  const account = useAccount();
  const subscription = useSubscription();
  const [code, setCode] = useState<{ userCode: string; verificationUrl: string } | null>(null);
  return (
    <div className={styles.list}>
      {account.data ? (
        <>
          <InfoRow label="Account" value={<>{account.data.displayName} {account.data.isDemo ? <Badge tone="outline">Demo</Badge> : null}</>} />
          <InfoRow label="Email" value={account.data.email} />
          <InfoRow label="Country" value={account.data.country} />
        </>
      ) : (
        <InfoRow label="Account" value={account.isError ? 'Unavailable' : 'Loading…'} />
      )}
      {subscription.data ? (
        <>
          <InfoRow label="Plan" value={subscription.data.plan} />
          <InfoRow
            label="Packs"
            value={
              <span className={styles.packs}>
                {subscription.data.packs.map((p) => (
                  <Badge key={p.id} tone={p.active ? 'default' : 'outline'}>
                    {p.name}
                    {p.active ? '' : ' · not included'}
                  </Badge>
                ))}
              </span>
            }
          />
        </>
      ) : null}
      <ActionRow
        id="account:signin"
        label="Sign in on another device"
        description="Link this TV to an account with a short code"
        onSelect={async () => setCode(await getServices().auth.startDeviceSignIn())}
      />
      <p className={styles.note}>Account management requires a real account backend. This demo uses a placeholder household.</p>
      {code ? (
        <Dialog id="device-code" title="Sign in" onClose={() => setCode(null)} initialFocus="code:ok" width="sm">
          <p className={styles.note}>On your phone or computer, visit</p>
          <p className={styles.codeUrl}>{code.verificationUrl}</p>
          <p className={styles.note}>and enter the code</p>
          <p className={styles.code}>{code.userCode}</p>
          <FocusSection id="code-actions">
            <PillButton focusId="code:ok" label="Done" onSelect={() => setCode(null)} />
          </FocusSection>
        </Dialog>
      ) : null}
    </div>
  );
}

interface Check {
  name: string;
  status: 'pending' | 'ok' | 'fail' | 'skip';
  detail?: string;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: string }> {
  const t = performance.now();
  try {
    const value = await fn();
    return { ms: Math.round(performance.now() - t), value };
  } catch (e) {
    return { ms: Math.round(performance.now() - t), error: (e as Error).message };
  }
}

function NetworkSection() {
  const { online, usingFallback, lastError } = useCatalogStatus();
  const [checks, setChecks] = useState<Check[]>([]);
  const [run, setRun] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const results: Check[] = [
      { name: 'Internet connection', status: 'pending' },
      { name: 'TMDB proxy', status: 'pending' },
      { name: 'Backend API', status: 'pending' },
      { name: 'Artwork', status: 'pending' },
      { name: 'Sample stream', status: 'pending' },
    ];
    setChecks([...results]);
    const set = (i: number, c: Partial<Check>) => {
      results[i] = { ...results[i], ...c };
      if (!cancelled) setChecks([...results]);
    };
    set(0, navigator.onLine === false ? { status: 'fail', detail: 'Device reports offline' } : { status: 'ok', detail: 'Online' });
    void timed(() => fetch(`${appConfig.tmdbProxyUrl}/__status`).then((r) => r.json() as Promise<{ configured: boolean; reachable: boolean; status?: number; latencyMs?: number; error?: string }>)).then((r) => {
      if (r.error || !r.value) set(1, { status: 'fail', detail: `Proxy not reachable (${r.error ?? 'error'})` });
      else if (!r.value.configured) set(1, { status: 'fail', detail: 'TMDB_API_KEY is not configured on the server' });
      else if (!r.value.reachable) set(1, { status: 'fail', detail: `TMDB unreachable from server${r.value.status ? ` (HTTP ${r.value.status})` : ''}` });
      else set(1, { status: 'ok', detail: `Reachable · ${r.value.latencyMs} ms upstream` });
    });
    if (appConfig.dataMode === 'remote') {
      void timed(() => fetch(`${appConfig.apiBaseUrl}/account`).then((r) => (r.ok ? r : Promise.reject(new Error(`HTTP ${r.status}`))))).then((r) =>
        set(2, r.error ? { status: 'fail', detail: r.error } : { status: 'ok', detail: `${r.ms} ms` }),
      );
    } else set(2, { status: 'skip', detail: 'Not used (DATA_MODE=mock)' });
    const img = new Image();
    const t0 = performance.now();
    img.onload = () => set(3, { status: 'ok', detail: `${Math.round(performance.now() - t0)} ms` });
    img.onerror = () => set(3, { status: 'fail', detail: 'Image failed to load' });
    img.src = `/demo-art/avatars/slate.webp?diag=${run}`;
    void timed(() => fetch('/media/sample/hls/index.m3u8', { cache: 'no-store' }).then((r) => (r.ok ? r : Promise.reject(new Error(`HTTP ${r.status}`))))).then((r) =>
      set(4, r.error ? { status: 'fail', detail: r.error } : { status: 'ok', detail: `${r.ms} ms` }),
    );
    return () => {
      cancelled = true;
    };
  }, [run]);

  const catalog = getServices().catalog;
  return (
    <div className={styles.list}>
      <InfoRow label="Connection" value={online ? 'Online' : 'Offline'} />
      <InfoRow label="Catalog source" value={usingFallback ? 'Offline demo catalog (TMDB fallback)' : catalog.source === 'tmdb' ? 'TMDB' : catalog.source === 'demo' ? 'Offline demo catalog' : 'Remote API'} />
      {usingFallback && lastError ? <InfoRow label="Last catalog error" value={lastError} /> : null}
      <div className={styles.checks} data-testid="diagnostics">
        {checks.map((c) => (
          <div key={c.name} className={styles.check}>
            <span className={`${styles.dot} ${styles[`dot_${c.status}`]}`} />
            <span className={styles.checkName}>{c.name}</span>
            <span className={styles.checkDetail}>{c.status === 'pending' ? 'Checking…' : c.detail}</span>
          </div>
        ))}
      </div>
      <ActionRow id="network:rerun" icon="refresh" label="Run diagnostics again" onSelect={() => setRun((n) => n + 1)} />
      {catalog instanceof RoutedCatalog && usingFallback ? (
        <ActionRow
          id="network:retry-tmdb"
          icon="refresh"
          label="Retry TMDB"
          description="Switch back to live catalog data"
          onSelect={() => {
            catalog.retryPrimary();
            toast('Retrying TMDB…', 'info');
          }}
        />
      ) : null}
    </div>
  );
}

function AboutSection() {
  const platform = detectPlatform();
  return (
    <div className={styles.list}>
      <InfoRow label="Application" value={brand.productName} />
      <InfoRow label="Version" value={`${appConfig.version} (${new Date(appConfig.buildTime).toLocaleDateString('en-GB')})`} />
      <InfoRow label="Data mode" value={appConfig.dataMode} />
      <InfoRow label="Catalog source" value={appConfig.catalogSource} />
      <InfoRow label="Platform" value={platform} />
      <InfoRow label="Screen" value={`${window.screen.width}×${window.screen.height} · viewport ${window.innerWidth}×${window.innerHeight}`} />
      <p className={styles.note}>{brand.disclaimer}</p>
      <p className={styles.note}>
        This product uses the TMDB API but is not endorsed or certified by TMDB. Movie and TV metadata and images © their
        respective owners via TMDB. Live TV channels, schedules and the demo catalog are fictional. Video playback uses a
        generated sample video.
      </p>
    </div>
  );
}
