import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import { LoadingBrandMark } from '@cuberoot/app-ui/loading-brand';

import { loadDesktopHost } from './tauri-host';

const App = lazy(async () => {
  const [module, host] = await Promise.all([import('@cuberoot/app-ui'), loadDesktopHost()]);
  return { default: () => <module.App host={host} loadingMark={<LoadingBrandMark />} /> };
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root mount point');

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<main className="loading-screen"><LoadingBrandMark /></main>}>
      <App />
    </Suspense>
  </StrictMode>,
);
