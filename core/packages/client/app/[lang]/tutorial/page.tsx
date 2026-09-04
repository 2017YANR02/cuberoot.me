'use client';

import BackHome from '@/components/BackHome';
import { T } from '@/i18n/tr';
import '../alg/alg.css';

export default function TutorialPage() {
  return (
    <main className="alg-root">
      <header className="alg-cat-header alg-cat-header--puzzle">
        <div className="alg-puzzle-back-row"><BackHome /></div>
        <h1 className="alg-cat-title"><T zh="教程" en="Tutorials" /></h1>
      </header>
    </main>
  );
}
