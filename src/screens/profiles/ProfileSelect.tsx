import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/BrandLogo';
import { Icon } from '@/components/Icon';
import { Img } from '@/components/Img';
import { PinDialog } from '@/components/PinPad';
import { PillButton } from '@/components/ui';
import { FocusSection, Focusable, useScreenFocus } from '@/navigation/react';
import { Clock } from '@/layout/NavBar';
import { paths } from '@/app/paths';
import { avatarUrl } from '@/config/avatars';
import { brand } from '@/config/brand';
import { MAX_PROFILES, useActiveProfile, useProfiles } from '@/state/profiles';
import styles from './ProfileSelect.module.css';

export default function ProfileSelect() {
  const navigate = useNavigate();
  const profiles = useProfiles((s) => s.profiles);
  const select = useProfiles((s) => s.select);
  const active = useActiveProfile();
  const [manage, setManage] = useState(false);
  // Leaving a Kids profile requires the parent PIN.
  const [locked, setLocked] = useState(active?.kind === 'kids');

  useScreenFocus('profiles', { defaultId: `profile:${active?.id ?? profiles[0]?.id}`, ready: !locked });

  const choose = (id: string) => {
    if (manage) {
      navigate(paths.editProfile(id));
      return;
    }
    const p = profiles.find((x) => x.id === id)!;
    select(id);
    navigate(p.kind === 'kids' ? paths.kids : paths.home, { replace: true });
  };

  return (
    <div className={styles.screen} data-testid="profile-select">
      <header className={styles.top}>
        <BrandLogo size="lg" />
        <Clock className={styles.clock} />
      </header>
      <div className={styles.content}>
        <h1 className={styles.heading}>{manage ? 'Manage profiles' : 'Who’s watching?'}</h1>
        <p className={styles.sub}>
          {manage ? 'Choose a profile to edit.' : `Choose a profile to enjoy the best of ${brand.name}, personalised for you.`}
        </p>
        <FocusSection id="profiles">
          <div className={styles.row} role="list">
            {profiles.map((p) => (
              <Focusable
                key={p.id}
                focusId={`profile:${p.id}`}
                className={styles.profile}
                onSelect={() => choose(p.id)}
                role="listitem"
                aria-label={`${p.name}${p.kind === 'kids' ? ' (Kids)' : ''}${manage ? ', edit' : ''}`}
                data-testid={`profile-${p.name}`}
              >
                <span className={styles.avatar}>
                  <Img src={avatarUrl(p.avatarId)} alt="" width={240} eager />
                  {manage ? (
                    <span className={styles.editOverlay}>
                      <Icon name="edit" size="2.2rem" />
                    </span>
                  ) : null}
                </span>
                <span className={styles.name}>{p.name}</span>
                {p.kind === 'kids' ? <span className={styles.kidsTag}>Kids</span> : null}
              </Focusable>
            ))}
            {profiles.length < MAX_PROFILES ? (
              <Focusable focusId="profile:add" className={styles.profile} onSelect={() => navigate(paths.newProfile)} aria-label="Add profile" data-testid="profile-add">
                <span className={`${styles.avatar} ${styles.add}`}>
                  <Icon name="plus" size="3rem" />
                </span>
                <span className={styles.name}>Add profile</span>
              </Focusable>
            ) : null}
          </div>
        </FocusSection>
        <FocusSection id="profiles-actions">
          <div className={styles.actions}>
            <PillButton
              focusId="profiles:manage"
              icon={manage ? 'check' : 'edit'}
              label={manage ? 'Done' : 'Manage profiles'}
              onSelect={() => setManage((m) => !m)}
              size="sm"
            />
          </div>
        </FocusSection>
      </div>
      <p className={styles.disclaimer}>{brand.disclaimer}</p>
      {locked ? (
        <PinDialog
          title="Leave Kids?"
          message="Enter the parent PIN to switch profile."
          onSuccess={() => setLocked(false)}
          onClose={() => navigate(paths.kids, { replace: true })}
        />
      ) : null}
    </div>
  );
}
