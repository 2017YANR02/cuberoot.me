'use client';

// /regulation — announcements, regulations, incidents and disciplinary entries.

import { useTranslation } from 'react-i18next';
import { Newspaper, ArrowRight, ScrollText } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { useT } from '../../../hooks/useT';
import './regulation.css';
import { LATEST_NEWS as LATEST_REG_NEWS } from '@/lib/regulation-posts';
import { tr } from '@/i18n/tr';

export default function RegulationHub() {
  useTranslation();
  const t = useT();

  return (
    <div className="reg-page">
      <div className="reg-wrap">
        <BackHome />
        <header className="reg-hero">
          <h1 className="reg-title">
            {t('WCA ', 'WCA ')}
            <span className="reg-code">{t('竞赛规则', 'Regulations')}</span>
          </h1>
        </header>

        <Link href={`/regulation/post/${LATEST_REG_NEWS.id}`} prefetch={false} className="reg-hub-news">
          <span className="reg-hub-news-icon"><Newspaper size={22} /></span>
          <span className="reg-hub-news-body">
            <span className="reg-hub-news-eyebrow">
              <span className="reg-hub-news-dot" />
              {t('最新动态', "What’s New")}
            </span>
            <span className="reg-hub-news-title">
              {tr(LATEST_REG_NEWS.title)}
            </span>
          </span>
          <ArrowRight size={20} className="reg-hub-news-arrow" />
        </Link>

        <Link href="/regulation/post" prefetch={false} className="reg-hub-news">
          <span className="reg-hub-news-icon"><Newspaper size={22} /></span>
          <span className="reg-hub-news-body">
            <span className="reg-hub-news-title">{t('公告', 'Posts')}</span>
          </span>
          <ArrowRight size={20} className="reg-hub-news-arrow" />
        </Link>

        <Link href="/regulation/rules" className="reg-hub-news">
          <span className="reg-hub-news-icon"><ScrollText size={22} /></span>
          <span className="reg-hub-news-body">
            <span className="reg-hub-news-title">
              {t('规则', 'Regulations')}
            </span>
          </span>
          <ArrowRight size={20} className="reg-hub-news-arrow" />
        </Link>

        <Link href="/regulation/translation" prefetch={false} className="reg-hub-news">
          <span className="reg-hub-news-icon"><ScrollText size={22} /></span>
          <span className="reg-hub-news-body">
            <span className="reg-hub-news-title">{t('英中翻译参考', 'English–Chinese translation reference')}</span>
          </span>
          <ArrowRight size={20} className="reg-hub-news-arrow" />
        </Link>

        {[
          { kind: 'incidents', title: { zh: '意外事件', en: 'Incidents' } },
          { kind: 'disciplinary', title: { zh: '纪律处分', en: 'Disciplinary' } },
        ].map((log) => (
          <Link key={log.kind} href={`/regulation/logs?kind=${log.kind}`} prefetch={false} className="reg-hub-news">
            <span className="reg-hub-news-icon"><ScrollText size={22} /></span>
            <span className="reg-hub-news-body">
              <span className="reg-hub-news-title">{tr(log.title)}</span>
            </span>
            <ArrowRight size={20} className="reg-hub-news-arrow" />
          </Link>
        ))}


      </div>
    </div>
  );
}
