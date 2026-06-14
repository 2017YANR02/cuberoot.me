'use client';

/**
 * /memo — Memo (记忆) sub-hub.
 *
 * 1:1 port from packages/client/src/pages/memo/MemoLandingPage.tsx (Vite SPA).
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { Brain, type LucideIcon } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../../landing.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface MemoCard {
  id: string;
  href: string;
  Icon: LucideIcon;
  zh: string;
  en: string;
}

const CARDS: MemoCard[] = [
  { id: 'colpi', href: '/memo/colpi', Icon: Brain, zh: '字母对', en: 'CoLPI'
},
];

export default function MemoLandingPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('记忆', 'Memo');

  return (
    <div className="landing-page">
      <h1 className="landing-tagline">{tr({ zh: '记忆', en: 'Memo'
    })}</h1>

      <div className="cards-container">
        {CARDS.map(c => (
          <Link key={c.id} href={c.href} className="card tier-standard" id={`card-${c.id}`}>
            <div className="card-icon">
              <c.Icon size={24} strokeWidth={1.5} />
            </div>
            <div className="card-name">{((i18n.language.startsWith('zh') ? c.zh : c.en))}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
