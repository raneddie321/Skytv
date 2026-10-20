import { useNavigate } from 'react-router-dom';
import { PillButton } from '@/components/ui';
import { FocusSection, useScreenFocus } from '@/navigation/react';

export default function NotFound() {
  const navigate = useNavigate();
  useScreenFocus('not-found', { defaultId: 'nf:home' });
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: '0.6rem' }}>Page not found</h1>
        <p style={{ color: 'var(--c-text-2)', marginBottom: '1.4rem' }}>That screen doesn’t exist.</p>
        <FocusSection id="nf">
          <PillButton focusId="nf:home" variant="primary" icon="home" label="Go home" onSelect={() => navigate('/')} />
        </FocusSection>
      </div>
    </div>
  );
}
