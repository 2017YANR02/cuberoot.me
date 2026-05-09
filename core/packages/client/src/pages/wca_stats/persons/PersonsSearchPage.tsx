import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search } from 'lucide-react';
import { WcaPersonPicker } from '@cuberoot/shared';
import LangToggle from '../../../components/LangToggle';
import './persons.css';

export default function PersonsSearchPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  return (
    <div className="wp-page">
      <header className="wp-header">
        <Link to="/wca-stats" className="wp-back">
          <ChevronLeft size={16} />
          <span>{t('WCA 统计', 'WCA Stats')}</span>
        </Link>
        <div className="wp-header-right">
          <LangToggle />
        </div>
      </header>

      <main className="wp-main">
        <section className="wp-search-card">
          <div className="wp-search-icon"><Search size={28} /></div>
          <h1 className="wp-search-title">{t('选手成绩查询', 'Persons')}</h1>
          <p className="wp-search-hint">
            {t(
              '输入姓名、WCA ID(如 2014YANG02)或中文名',
              'Search by name, WCA ID (e.g. 2014YANG02), or Chinese characters',
            )}
          </p>
          <div className="wp-search-picker">
            <WcaPersonPicker
              mode="inline"
              placeholder={t('输入姓名或 WCA ID…', 'Enter name or WCA ID…')}
              onSelect={(p) => navigate(`/wca-stats/persons/${p.wcaId}`)}
            />
          </div>
          <div className="wp-search-examples">
            <span className="wp-search-examples-label">{t('试试', 'Try')}:</span>
            {['2023GENG02', '2014YANG02', '2009ZEMD01', '2003POCH01'].map((id) => (
              <button
                key={id}
                className="wp-search-example"
                onClick={() => navigate(`/wca-stats/persons/${id}`)}
              >{id}</button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
