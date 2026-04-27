import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserRound } from 'lucide-react';
import { WcaPersonPicker } from '@cuberoot/shared';
import './persons.css';

export default function PersonsSearchPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  return (
    <div className="wca-persons-page">
      <header className="wca-persons-header">
        <div className="wca-persons-title">
          <UserRound size={20} className="wca-persons-title-icon" />
          <h1>{t('选手成绩查询', 'Persons')}</h1>
        </div>
      </header>

      <main className="wca-persons-main">
        <p className="wca-persons-hint">
          {t(
            '搜索任意 WCA 选手 — 支持姓名、WCA ID(如 2014YANG02)、中文名',
            'Search any WCA cuber — by name, WCA ID (e.g. 2014YANG02), or Chinese characters',
          )}
        </p>
        <div className="wca-persons-picker-wrap">
          <WcaPersonPicker
            mode="inline"
            placeholder={t('输入姓名或 WCA ID…', 'Enter name or WCA ID…')}
            onSelect={(p) => navigate(`/wca-stats/persons/${p.wcaId}`)}
          />
        </div>
      </main>
    </div>
  );
}
