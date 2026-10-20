import { useCallback, useEffect, useRef, useState } from 'react';
import type { Channel, EpisodeRef, MediaRef, PlaybackSession, Programme } from '@/api/contracts/domain';
import { getServices } from '@/api';
import { ChannelLogo } from '@/components/ChannelLogo';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { Img } from '@/components/Img';
import { Badge, PillButton, ProgressBar, formatClock, formatTime } from '@/components/ui';
import { FocusSection, Focusable, useActionListener, useBackHandler, useFocusManager, useFocusedId, useScreenFocus } from '@/navigation/react';
import { PlayerEngine, type PlayMethod } from '@/player/engine';
import { isCompleted, useLibrary } from '@/state/library';
import { useSettings } from '@/state/settings';
import styles from './Player.module.css';

export interface PlayerItem {
  key: string;
  title: string;
  subtitle?: string;
  media?: MediaRef;
  episode?: EpisodeRef;
  nextEpisode?: EpisodeRef;
  certification?: string;
  kidsSafe?: boolean;
  backPath: string;
  live?: { channel: Channel; programme?: Programme; next?: Programme; prevChannelId: string; nextChannelId: string };
}

interface PlayerViewProps {
  item: PlayerItem;
  session: PlaybackSession;
  startAt: number;
  profileId: string;
  onExit: () => void;
  onPlayNext: (episode: EpisodeRef) => void;
  onChangeChannel: (channelId: string) => void;
}

const HIDE_AFTER_MS = 4000;
const SAVE_EVERY_MS = 5000;
const UP_NEXT_SECONDS = 12;

export function PlayerView({ item, session, startAt, profileId, onExit, onPlayNext, onChangeChannel }: PlayerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PlayerEngine | null>(null);
  const manager = useFocusManager();
  const focusedId = useFocusedId();
  const settings = useSettings();
  const updateSettings = useSettings((s) => s.update);
  const saveProgress = useLibrary((s) => s.saveProgress);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [controls, setControls] = useState(true);
  const [subsOpen, setSubsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [method, setMethod] = useState<PlayMethod | null>(null);
  const [ended, setEnded] = useState(false);
  const [upNextDismissed, setUpNextDismissed] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const startAtRef = useRef(startAt);
  const isLive = session.isLive;

  // ------------------------------------------------------------------ progress persistence
  const save = useCallback(
    (forceCompleted?: boolean) => {
      const v = videoRef.current;
      if (!v || isLive || !item.media || !Number.isFinite(v.duration) || v.duration <= 0) return;
      const positionSec = forceCompleted ? v.duration : v.currentTime;
      if (positionSec < 1 && !forceCompleted) return;
      saveProgress(profileId, {
        key: item.key,
        media: item.media,
        episode: item.episode,
        nextEpisode: item.nextEpisode,
        positionSec,
        durationSec: v.duration,
        completed: !!forceCompleted || isCompleted(positionSec, v.duration),
        updatedAt: new Date().toISOString(),
      });
    },
    [isLive, item, profileId, saveProgress],
  );
  const saveRef = useRef(save);
  saveRef.current = save;

  // ------------------------------------------------------------------ engine lifecycle
  useEffect(() => {
    const video = videoRef.current!;
    const engine = new PlayerEngine(video);
    engineRef.current = engine;
    let cancelled = false;
    engine
      .load(session.sources, settings.playback.preferredStream)
      .then(({ method: m }) => {
        if (cancelled) return;
        setMethod(m);
        let start = startAtRef.current;
        if (isLive && item.live?.programme && Number.isFinite(video.duration)) {
          // Simulated live: join the sample loop at the programme's elapsed time.
          start = ((Date.now() - Date.parse(item.live.programme.start)) / 1000) % video.duration;
        }
        if (start > 0 && start < video.duration - 5) video.currentTime = start;
        setDuration(video.duration);
        setReady(true);
        video.play().catch(() => setPlaying(false));
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      saveRef.current();
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    const v = videoRef.current!;
    const onTime = () => setTime(v.currentTime);
    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
    };
    const onPause = () => {
      setPlaying(false);
      saveRef.current();
    };
    const onDuration = () => setDuration(v.duration);
    const onVolume = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    const onEnded = () => {
      setEnded(true);
      setPlaying(false);
      saveRef.current(true);
    };
    const onSeeked = () => saveRef.current();
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('durationchange', onDuration);
    v.addEventListener('volumechange', onVolume);
    v.addEventListener('ended', onEnded);
    v.addEventListener('seeked', onSeeked);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('durationchange', onDuration);
      v.removeEventListener('volumechange', onVolume);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('seeked', onSeeked);
    };
  }, []);

  // Periodic save + session heartbeat.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => saveRef.current(), SAVE_EVERY_MS);
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => {
    const services = getServices();
    const t = setInterval(() => {
      void services.playback.heartbeat(session.sessionId, videoRef.current?.currentTime ?? 0).catch(() => undefined);
    }, session.heartbeatIntervalSec * 1000);
    return () => {
      clearInterval(t);
      void services.playback.endSession(session.sessionId).catch(() => undefined);
    };
  }, [session]);

  // Subtitles: reflect the saved preference onto the text tracks.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !ready) return;
    const tracks = Array.from(v.textTracks);
    tracks.forEach((t) => {
      t.mode = settings.subtitles.enabled && t.language === settings.subtitles.language ? 'showing' : 'disabled';
    });
  }, [settings.subtitles.enabled, settings.subtitles.language, ready]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ------------------------------------------------------------------ controls visibility
  const poke = useCallback(() => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControls(false);
    }, HIDE_AFTER_MS);
  }, []);
  useEffect(() => {
    if (playing) poke();
    else {
      clearTimeout(hideTimer.current);
      setControls(true);
    }
    return () => clearTimeout(hideTimer.current);
  }, [playing, poke]);

  useScreenFocus(`player:${item.key}`, { defaultId: 'player:play', ready: true });

  // ------------------------------------------------------------------ actions
  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) void v.play().catch(() => undefined);
    else v.pause();
  };
  const seekBy = (delta: number) => {
    const v = videoRef.current;
    if (!v || isLive || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration - 0.5, v.currentTime + delta));
    setTime(v.currentTime);
  };
  const setVol = (next: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, Math.round(next * 10) / 10));
    v.muted = v.volume === 0 ? true : false;
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void containerRef.current?.requestFullscreen?.().catch(() => undefined);
  };
  const playNext = () => {
    if (!item.nextEpisode) return;
    save(true);
    onPlayNext(item.nextEpisode);
  };

  const remaining = duration - time;
  const showUpNext = !!item.nextEpisode && !upNextDismissed && ready && duration > 0 && (ended || remaining <= UP_NEXT_SECONDS);

  // Auto-advance to the next episode at the end when enabled.
  useEffect(() => {
    if (ended && item.nextEpisode && settings.playback.autoplayNext && !upNextDismissed) {
      const t = setTimeout(playNext, 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  useEffect(() => {
    if (showUpNext) manager.requestFocus('player:upnext');
  }, [showUpNext, manager]);

  useActionListener((e) => {
    if (subsOpen) return false;
    poke();
    switch (e.action) {
      case 'playPause':
        toggle();
        return true;
      case 'play':
        void videoRef.current?.play().catch(() => undefined);
        return true;
      case 'pause':
        videoRef.current?.pause();
        return true;
      case 'stop':
        onExit();
        return true;
      case 'rewind':
        seekBy(-30);
        return true;
      case 'fastForward':
        seekBy(30);
        return true;
      case 'next':
        playNext();
        return true;
      case 'channelUp':
        if (item.live) onChangeChannel(item.live.nextChannelId);
        return !!item.live;
      case 'channelDown':
        if (item.live) onChangeChannel(item.live.prevChannelId);
        return !!item.live;
    }
    if (!controls) {
      // First key press while controls are hidden: reveal them; OK toggles, left/right seek.
      if (e.action === 'enter') toggle();
      else if (e.action === 'left') seekBy(-10);
      else if (e.action === 'right') seekBy(10);
      else if (e.action === 'back') return false;
      return e.action !== null;
    }
    if (focusedId === 'player:seek' && (e.action === 'left' || e.action === 'right')) {
      seekBy((e.action === 'left' ? -1 : 1) * (e.repeat ? 30 : 10));
      return true;
    }
    if (focusedId === 'player:volume' && (e.action === 'left' || e.action === 'right')) {
      setVol(volume + (e.action === 'left' ? -0.1 : 0.1));
      return true;
    }
    return false;
  });

  useBackHandler(() => {
    if (subsOpen) return false; // dialog handles it
    if (showUpNext && !ended) {
      setUpNextDismissed(true);
      return true;
    }
    onExit();
    return true;
  });

  const live = item.live;
  const progLive = live?.programme
    ? (Date.now() - Date.parse(live.programme.start)) / (Date.parse(live.programme.end) - Date.parse(live.programme.start))
    : 0;
  const visible = controls || !playing || !!error;

  return (
    <div
      ref={containerRef}
      className={`${styles.player} ${visible ? styles.controlsOn : styles.controlsOff}`}
      data-subtitle-size={settings.subtitles.size}
      data-subtitle-bg={settings.subtitles.background}
      data-testid="player"
      data-playing={playing}
      data-method={method ?? ''}
      onMouseMove={poke}
    >
      <video ref={videoRef} className={styles.video} playsInline preload="auto" crossOrigin="anonymous" data-testid="player-video">
        {session.subtitles.map((t) => (
          <track key={t.id} kind={t.kind} src={t.url} srcLang={t.language} label={t.label} />
        ))}
      </video>

      {!ready && !error ? <div className={styles.spinner} aria-label="Loading" /> : null}

      <div className={styles.topBar}>
        <FocusSection id="player-top">
          <Focusable focusId="player:back" className={styles.roundButton} aria-label="Back" onSelect={onExit}>
            <Icon name="back" size="1.4rem" />
          </Focusable>
        </FocusSection>
        <div className={styles.heading}>
          <div className={styles.title}>{item.title}</div>
          {item.subtitle ? <div className={styles.subtitle}>{item.subtitle}</div> : null}
        </div>
        <div className={styles.flags}>
          {isLive ? <Badge tone="live">Live</Badge> : null}
          {session.isSample ? (
            <Badge tone="outline">
              <Icon name="info" size="0.9rem" /> Sample video
            </Badge>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className={styles.errorBox} role="alert">
          <h2>Playback error</h2>
          <p>{error}</p>
        </div>
      ) : null}

      <div className={styles.bottom}>
        {live ? (
          <div className={styles.liveInfo}>
            <ChannelLogo channel={live.channel} size="md" />
            <div className={styles.liveText}>
              <div className={styles.liveTitle}>{live.programme?.title ?? live.channel.name}</div>
              {live.programme ? (
                <div className={styles.liveTimes}>
                  {formatTime(live.programme.start)} – {formatTime(live.programme.end)}
                  {live.next ? <span> · Next: {live.next.title}</span> : null}
                </div>
              ) : null}
              <ProgressBar value={progLive} live className={styles.liveBar} />
            </div>
            <div className={styles.channelHint}>
              <Icon name="chevronUp" /> <Icon name="chevronDown" /> Channel
            </div>
          </div>
        ) : (
          <FocusSection id="player-seek">
            <div className={styles.timeline}>
              <span className={styles.time}>{formatClock(time)}</span>
              <Focusable
                focusId="player:seek"
                className={styles.seek}
                role="slider"
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration) || 0}
                aria-valuenow={Math.round(time)}
                aria-valuetext={`${formatClock(time)} of ${formatClock(duration)}`}
                onSelect={toggle}
              >
                <span className={styles.seekTrack}>
                  <span className={styles.seekFill} style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
                  <span className={styles.seekThumb} style={{ left: `${duration ? (time / duration) * 100 : 0}%` }} />
                </span>
              </Focusable>
              <span className={styles.time}>-{formatClock(Math.max(0, remaining))}</span>
            </div>
          </FocusSection>
        )}
        <FocusSection id="player-controls">
          <div className={styles.controls}>
            <div className={styles.group}>
              {!isLive ? (
                <Focusable focusId="player:back10" className={styles.roundButton} aria-label="Back 10 seconds" onSelect={() => seekBy(-10)}>
                  <Icon name="replay10" size="1.5rem" />
                </Focusable>
              ) : null}
              <Focusable focusId="player:play" className={`${styles.roundButton} ${styles.playButton}`} aria-label={playing ? 'Pause' : 'Play'} onSelect={toggle} data-testid="player-play">
                <Icon name={playing ? 'pause' : 'play'} size="1.7rem" />
              </Focusable>
              {!isLive ? (
                <Focusable focusId="player:fwd10" className={styles.roundButton} aria-label="Forward 10 seconds" onSelect={() => seekBy(10)}>
                  <Icon name="forward10" size="1.5rem" />
                </Focusable>
              ) : null}
            </div>
            <div className={styles.group}>
              <Focusable focusId="player:mute" className={styles.roundButton} aria-label={muted ? 'Unmute' : 'Mute'} onSelect={() => videoRef.current && (videoRef.current.muted = !videoRef.current.muted)}>
                <Icon name={muted || volume === 0 ? 'volumeMute' : 'volume'} size="1.4rem" />
              </Focusable>
              <Focusable focusId="player:volume" className={styles.volume} role="slider" aria-label="Volume" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(volume * 100)}>
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={!muted && i < Math.round(volume * 10) ? styles.volOn : ''} />
                ))}
              </Focusable>
              {session.subtitles.length ? (
                <Focusable focusId="player:subs" className={`${styles.roundButton} ${settings.subtitles.enabled ? styles.on : ''}`} aria-label="Subtitles" onSelect={() => setSubsOpen(true)} data-testid="player-subtitles">
                  <Icon name="subtitles" size="1.4rem" />
                </Focusable>
              ) : null}
              {item.nextEpisode ? (
                <PillButton focusId="player:next" icon="next" label="Next episode" size="sm" onSelect={playNext} />
              ) : null}
              <Focusable focusId="player:fullscreen" className={styles.roundButton} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} onSelect={toggleFullscreen}>
                <Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} size="1.4rem" />
              </Focusable>
            </div>
          </div>
        </FocusSection>
      </div>

      {!playing && ready && !ended && !error ? (
        <div className={styles.pausedBadge} aria-hidden="true">
          <Icon name="pause" size="2.4rem" />
        </div>
      ) : null}

      {showUpNext && item.nextEpisode ? (
        <div className={styles.upNext} role="dialog" aria-label="Up next">
          <FocusSection id="player-upnext" block={['up', 'left']}>
            <Focusable focusId="player:upnext" className={styles.upNextCard} onSelect={playNext} data-testid="player-upnext">
              <div className={styles.upNextImg}>
                <Img src={item.nextEpisode.stillUrl ?? item.media?.backdropUrl} alt="" width={320} />
                <span className={styles.upNextPlay}>
                  <Icon name="play" size="1.3rem" />
                </span>
              </div>
              <div>
                <div className={styles.upNextKicker}>
                  Up next{!ended ? ` in ${Math.max(0, Math.ceil(remaining))}s` : ''}
                </div>
                <div className={styles.upNextTitle}>
                  S{item.nextEpisode.seasonNumber} E{item.nextEpisode.episodeNumber} · {item.nextEpisode.title}
                </div>
              </div>
            </Focusable>
          </FocusSection>
        </div>
      ) : null}

      {ended && !item.nextEpisode && !isLive ? (
        <div className={styles.endCard}>
          <h2>Finished</h2>
          <FocusSection id="player-end">
            <div className={styles.messageActions}>
              <PillButton focusId="player:details" variant="primary" icon="back" label="Back to details" onSelect={onExit} />
              <PillButton
                focusId="player:replay"
                icon="replay10"
                label="Watch again"
                onSelect={() => {
                  const v = videoRef.current;
                  if (v) {
                    v.currentTime = 0;
                    void v.play();
                  }
                }}
              />
            </div>
          </FocusSection>
        </div>
      ) : null}

      {subsOpen ? (
        <Dialog id="subtitles" title="Subtitles" onClose={() => setSubsOpen(false)} initialFocus={`subs:${settings.subtitles.enabled ? settings.subtitles.language : 'off'}`} width="sm">
          <FocusSection id="subs-options">
            <div className={styles.subsList}>
              {[{ id: 'off', label: 'Off', language: '' }, ...session.subtitles].map((t) => {
                const selected = t.id === 'off' ? !settings.subtitles.enabled : settings.subtitles.enabled && settings.subtitles.language === t.language;
                return (
                  <Focusable
                    key={t.id}
                    focusId={`subs:${t.id === 'off' ? 'off' : t.language}`}
                    className={styles.subsOption}
                    aria-pressed={selected}
                    onSelect={() => {
                      if (t.id === 'off') updateSettings('subtitles', { enabled: false });
                      else updateSettings('subtitles', { enabled: true, language: t.language as 'en' | 'fr' });
                      setSubsOpen(false);
                    }}
                  >
                    <span>{t.label}</span>
                    {selected ? <Icon name="check" /> : null}
                  </Focusable>
                );
              })}
            </div>
          </FocusSection>
        </Dialog>
      ) : null}
    </div>
  );
}
