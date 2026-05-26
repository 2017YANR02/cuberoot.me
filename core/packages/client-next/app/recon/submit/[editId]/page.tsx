'use client';

// /recon/submit/[editId] — same stub as /recon/submit. See parent for TODO list.
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../../recon.css';

export default function ReconEditSubmitPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('编辑复盘', 'Edit Reconstruction');

  return (
    <div className="recon-page">
      <div className="recon-page-header">
        <div>
          <Link href="/recon" className="recon-back-link">
            <ArrowLeft size={14} /> {isZh ? '返回列表' : 'Back to list'}
          </Link>
          <h1>{isZh ? '编辑复盘' : 'Edit Reconstruction'}</h1>
        </div>
        <LangToggle />
      </div>
      <div className="recon-detail-stub" style={{ padding: 24 }}>
        <p>
          {isZh
            ? '编辑功能（OAuth + WCIF + 自动补全）尚未在 Next.js 版本中实现。'
            : 'Edit (OAuth + WCIF + autofill) is not yet implemented in the Next.js port.'}
        </p>
      </div>
    </div>
  );
}
