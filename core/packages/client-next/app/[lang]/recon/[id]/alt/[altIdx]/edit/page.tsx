'use client';
// /recon/[id]/alt/[altIdx]/edit — edit existing alternative solution.

import { useParams } from 'next/navigation';
import AltSubmitForm from '../../AltSubmitForm';

export default function EditAltPage() {
  const params = useParams<{ id: string; altIdx: string }>();
  const id = (Array.isArray(params?.id) ? params.id[0] : params?.id) ?? '';
  const altIdxStr = (Array.isArray(params?.altIdx) ? params.altIdx[0] : params?.altIdx) ?? '';
  return <AltSubmitForm parentId={id} editIdx={Number(altIdxStr)} />;
}
