import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';
import { ScreenFallback } from './ScreenFallback';
import styles from './AppShell.module.css';

/** Layout for the adult experience: navigation bar + routed screen. */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <NavBar />
      <main className={styles.main} id="main">
        <Suspense fallback={<ScreenFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
