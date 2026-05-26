'use client';

/**
 * /recon/submit — submit page (STUB).
 *
 * TODO (deferred from full client port):
 *   - WCA OAuth login (useAuthStore + Implicit Grant flow + /auth/callback)
 *   - WcaPersonPicker + CompPicker (depend on wca_api index + comp_search)
 *   - WCIF parser (comp_wcif.ts)
 *   - Smart paste / autofill (recon_autofill_core + ReconAutofill component)
 *   - TwistySection live preview
 *   - Round/aoType derivation + form validation
 *
 * Until those land, redirect users back to the list page with a banner.
 */
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../recon.css';

export default function ReconSubmitPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('提交复盘', 'Submit Reconstruction');

  return (
    <div className="recon-page">
      <div className="recon-page-header">
        <div>
          <Link href="/recon" className="recon-back-link">
            <ArrowLeft size={14} /> {isZh ? '返回列表' : 'Back to list'}
          </Link>
          <h1>{isZh ? '提交复盘' : 'Submit Reconstruction'}</h1>
        </div>
        <LangToggle />
      </div>
      <div className="recon-detail-stub" style={{ padding: 24 }}>
        <p style={{ marginBottom: 12 }}>
          {isZh
            ? '提交 / 编辑功能（OAuth 登录、WCIF 解析、自动补全、TwistySection 预览）尚未在 Next.js 版本中实现。'
            : 'Submit/edit (OAuth login, WCIF parse, autofill, TwistySection preview) is not yet implemented in the Next.js port.'}
        </p>
        <p>
          {isZh ? '请暂时使用 Vite 版本: ' : 'Please use the Vite SPA for now: '}
          <a href="https://cuberoot.me/recon/submit">cuberoot.me/recon/submit</a>
        </p>
      </div>
    </div>
  );
}
