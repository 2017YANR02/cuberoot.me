'use client';

// /recon/[id]/alt/[altIdx]/edit — STUB. Needs OAuth + TwistySection.
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../../../../recon.css';

export default function AltEditPage() {
  const params = useParams<{ id: string; altIdx: string }>();
  const parentId = (Array.isArray(params?.id) ? params.id[0] : params?.id) ?? '';
  const altIdx = (Array.isArray(params?.altIdx) ? params.altIdx[0] : params?.altIdx) ?? '';
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('编辑另解', 'Edit Alternative');

  return (
    <div className="recon-page">
      <div className="recon-page-header">
        <div>
          <Link href={`/recon/${parentId}/alt/${altIdx}`} className="recon-back-link">
            <ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}
          </Link>
          <h1>{isZh ? '编辑另解' : 'Edit Alternative'}</h1>
        </div>
        <LangToggle />
      </div>
      <div className="recon-detail-stub" style={{ padding: 24 }}>
        <p>{isZh ? '编辑另解功能尚未实现。' : 'Edit alternative is not yet implemented in the Next.js port.'}</p>
      </div>
    </div>
  );
}
