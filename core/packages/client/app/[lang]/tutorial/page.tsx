'use client';

import BackHome from '@/components/BackHome';
import Link from '@/components/AppLink';
import { T } from '@/i18n/tr';
import { ArrowRight } from 'lucide-react';
import '../alg/alg.css';

export default function TutorialPage() {
  return (
    <main className="alg-root">
      <header className="alg-cat-header alg-cat-header--puzzle">
        <div className="alg-puzzle-back-row"><BackHome /></div>
        <h1 className="alg-cat-title"><T zh="教程" en="Tutorials" /></h1>
        <Link href="/tutorial-legacy" prefetch={false} className="alg-back">
          <T zh="旧版教程" en="Legacy tutorials" /> <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </header>
    </main>
  );
}
