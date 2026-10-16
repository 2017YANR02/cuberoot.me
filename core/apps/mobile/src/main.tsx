import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import '@cuberoot/app-ui/app.css';

import { capacitorHost } from './capacitor-host';
import { initializeDistribution } from './distribution';
import { initializeUURemote } from './uu-remote';

const App = lazy(async () => {
  const module = await import('@cuberoot/app-ui');
  return { default: module.App };
});

const root = document.getElementById('root');

// Remote callbacks must survive a cold launch even before Account is opened.
void initializeUURemote().catch(() => { /* Remote failure must not block the timer. */ });

if (!root) {
  throw new Error('Missing #root mount point');
}

void initializeDistribution().then(() => createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<main className="loading-screen"><strong>CubeRoot</strong></main>}>
      <App host={capacitorHost} />
    </Suspense>
  </StrictMode>,
));
