import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { Img } from '@/components/Img';
import { OnScreenKeyboard } from '@/components/OnScreenKeyboard';
import { PillButton } from '@/components/ui';
import { FocusSection, Focusable, useActionListener, useScreenFocus } from '@/navigation/react';
import { paths } from '@/app/paths';
import { AVATARS, avatarUrl } from '@/config/avatars';
import { createProfile, deleteProfile, updateProfile } from '@/state/profileActions';
import { useProfiles } from '@/state/profiles';
import { toast } from '@/state/toasts';
import styles from './ProfileEdit.module.css';

export default function ProfileEdit() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const existing = useProfiles((s) => s.profiles.find((p) => p.id === profileId));
  const profileCount = useProfiles((s) => s.profiles.length);
  const [name, setName] = useState(existing?.name ?? '');
  const [avatarId, setAvatarId] = useState(existing?.avatarId ?? AVATARS[profileCount % 8].id);
  const [kind, setKind] = useState(existing?.kind ?? 'adult');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const isNew = !existing;

  useScreenFocus(`profile-edit:${profileId ?? 'new'}`, { defaultId: 'osk:a' });

  const type = (c: string) => setName((n) => (n.length >= 20 ? n : (n + c).replace(/^\s+/, '')).replace(/\b\w/g, (m) => m.toUpperCase()));

  useActionListener((e) => {
    if (e.backspace) {
      setName((n) => n.slice(0, -1));
      return true;
    }
    if (e.char && e.char.length === 1 && /[\p{L}\p{N} ]/u.test(e.char) && e.action !== 'playPause') {
      type(e.char);
      return true;
    }
    return false;
  });

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast('Please enter a name', 'info');
      return;
    }
    setSaving(true);
    try {
      if (isNew) await createProfile({ name: trimmed, avatarId, kind });
      else await updateProfile(existing.id, { name: trimmed, avatarId, kind });
      toast(isNew ? 'Profile created' : 'Profile saved');
      navigate(paths.profiles, { replace: true });
    } catch {
      toast('Couldn’t save the profile. Try again.', 'wifi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.screen} data-testid="profile-edit">
      <h1 className={styles.heading}>{isNew ? 'Add profile' : 'Edit profile'}</h1>
      <div className={styles.layout}>
        <div className={styles.preview}>
          <div className={styles.avatar}>
            <Img src={avatarUrl(avatarId)} alt="" width={260} eager />
          </div>
          <div className={styles.nameField} aria-live="polite" data-testid="profile-name">
            {name || <span className={styles.placeholder}>Name</span>}
            <span className={styles.caret} />
          </div>
          <FocusSection id="profile-kind">
            <Focusable
              focusId="profile:kids-toggle"
              className={styles.toggle}
              role="switch"
              aria-checked={kind === 'kids'}
              onSelect={() => setKind((k) => (k === 'kids' ? 'adult' : 'kids'))}
            >
              <span>Kids profile</span>
              <span className={`${styles.switch} ${kind === 'kids' ? styles.on : ''}`} />
            </Focusable>
          </FocusSection>
          <p className={styles.help}>Kids profiles only show age-appropriate titles and need the parent PIN to exit.</p>
        </div>
        <div className={styles.keyboard}>
          <OnScreenKeyboard onChar={type} onDelete={() => setName((n) => n.slice(0, -1))} onClear={() => setName('')} />
        </div>
      </div>
      <h2 className={styles.sectionTitle}>Choose an avatar</h2>
      <FocusSection id="avatars">
        <div className={styles.avatars}>
          {AVATARS.map((a) => (
            <Focusable
              key={a.id}
              focusId={`avatar:${a.id}`}
              className={`${styles.avatarOption} ${a.id === avatarId ? styles.selected : ''}`}
              onSelect={() => setAvatarId(a.id)}
              aria-label={`Avatar ${a.label}`}
              aria-pressed={a.id === avatarId}
            >
              <Img src={avatarUrl(a.id)} alt="" width={120} />
              {a.id === avatarId ? (
                <span className={styles.check}>
                  <Icon name="check" size="1.2rem" />
                </span>
              ) : null}
            </Focusable>
          ))}
        </div>
      </FocusSection>
      <FocusSection id="profile-actions">
        <div className={styles.actions}>
          <PillButton focusId="profile:save" variant="primary" icon="check" label={saving ? 'Saving…' : 'Save'} onSelect={save} disabled={saving} />
          <PillButton focusId="profile:cancel" label="Cancel" onSelect={() => navigate(paths.profiles, { replace: true })} />
          {!isNew && profileCount > 1 ? (
            <PillButton focusId="profile:delete" icon="trash" label="Delete profile" onSelect={() => setConfirmDelete(true)} />
          ) : null}
        </div>
      </FocusSection>
      {confirmDelete && existing ? (
        <Dialog id="delete-profile" title={`Delete ${existing.name}?`} onClose={() => setConfirmDelete(false)} initialFocus="delete:cancel" width="sm">
          <p className={styles.help}>Their watchlist and viewing history will be removed from this device.</p>
          <FocusSection id="delete-actions">
            <div className={styles.actions}>
              <PillButton focusId="delete:cancel" label="Keep profile" onSelect={() => setConfirmDelete(false)} />
              <PillButton
                focusId="delete:confirm"
                icon="trash"
                label="Delete"
                onSelect={async () => {
                  await deleteProfile(existing.id);
                  toast('Profile deleted');
                  navigate(paths.profiles, { replace: true });
                }}
              />
            </div>
          </FocusSection>
        </Dialog>
      ) : null}
    </div>
  );
}
