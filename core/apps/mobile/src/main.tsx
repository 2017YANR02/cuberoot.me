import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import '@cuberoot/app-ui/app.css';
import '@cuberoot/app-ui/loading-brand.css';
import { LoadingBrandMark } from '@cuberoot/app-ui/loading-brand';

import { capacitorHost } from './capacitor-host';
import { initializeDistribution } from './distribution';
import { initializeUURemote } from './uu-remote';

const App = lazy(async () => {
  const [module] = await Promise.all([import('@cuberoot/app-ui'), initializeDistribution()]);
  return { default: module.App };
});

const root = document.getElementById('root');

// Remote callbacks must survive a cold launch even before Account is opened.
void initializeUURemote().catch(() => { /* Remote failure must not block the timer. */ });

if (!root) {
  throw new Error('Missing #root mount point');
}

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<main className="loading-screen"><LoadingBrandMark src="/startup-mark.svg" /></main>}>
      <App host={capacitorHost} loadingMark={<LoadingBrandMark src="/startup-mark.svg" />} />
    </Suspense>
  </StrictMode>,
);
