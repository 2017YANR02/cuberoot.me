'use client';

// /recon/submit-sketch — stub. See /recon/submit for the deferred-feature list.
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../recon.css';

export default function ReconSubmitSketchPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('快速复盘', 'Sketch Reconstruction');

  return (
    <div className="recon-page">
      <div className="recon-page-header">
        <div>
          <Link href="/recon" className="recon-back-link">
            <ArrowLeft size={14} /> {isZh ? '返回列表' : 'Back to list'}
          </Link>
          <h1>{isZh ? '快速复盘' : 'Sketch Reconstruction'}</h1>
        </div>
        <LangToggle />
      </div>
      <div className="recon-detail-stub" style={{ padding: 24 }}>
        <p>
          {isZh
            ? '快速复盘表单尚未在 Next.js 版本中实现。'
            : 'Sketch reconstruction form is not yet implemented in the Next.js port.'}
        </p>
      </div>
    </div>
  );
}
