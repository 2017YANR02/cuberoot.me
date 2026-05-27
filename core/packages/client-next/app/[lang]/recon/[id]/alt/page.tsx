'use client';

// /recon/[id]/alt — alternative submit (STUB). Needs OAuth + TwistySection.
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../../recon.css';

export default function AltSubmitPage() {
  const params = useParams<{ id: string }>();
  const parentId = (Array.isArray(params?.id) ? params.id[0] : params?.id) ?? '';
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('提交另解', 'Submit Alternative');

  return (
    <div className="recon-page">
      <div className="recon-page-header">
        <div>
          <Link href={`/recon/${parentId}`} className="recon-back-link">
            <ArrowLeft size={14} /> {isZh ? '返回详情' : 'Back to detail'}
          </Link>
          <h1>{isZh ? '提交另解' : 'Submit Alternative'}</h1>
        </div>
        <LangToggle />
      </div>
      <div className="recon-detail-stub" style={{ padding: 24 }}>
        <p>
          {isZh
            ? '另解提交（OAuth + TwistySection 预览）尚未在 Next.js 版本中实现。'
            : 'Alternative submit (OAuth + TwistySection preview) is not yet implemented in the Next.js port.'}
        </p>
      </div>
    </div>
  );
}
