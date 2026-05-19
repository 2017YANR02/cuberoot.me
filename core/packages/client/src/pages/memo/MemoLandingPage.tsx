/**
 * /memo — Memo (记忆) sub-hub.
 *
 * Lists memorization-related tools. Currently only CoLPI; more entries planned.
 * Reuses landing.css `.landing-page` styles for visual consistency with the root hub.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Brain, type LucideIcon } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import '../landing.css';

interface MemoCard {
  id: string;
  href: string;
  Icon: LucideIcon;
  zh: string;
  en: string;
}

const CARDS: MemoCard[] = [
  { id: 'colpi', href: '/memo/colpi', Icon: Brain, zh: '字母对', en: 'CoLPI' },
];

export default function MemoLandingPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('记忆', 'Memo');

  return (
    <div className="landing-page">
      <LangToggle variant="fixed" />

      <h1 className="landing-tagline">{isZh ? '记忆' : 'Memo'}</h1>

      <div className="cards-container">
        {CARDS.map(c => (
          <Link key={c.id} to={c.href} className="card tier-standard" id={`card-${c.id}`}>
            <div className="card-icon">
              <c.Icon size={24} strokeWidth={1.5} />
            </div>
            <div className="card-name">{isZh ? c.zh : c.en}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
