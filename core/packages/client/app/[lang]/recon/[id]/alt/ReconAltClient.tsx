'use client';
// /recon/[id]/alt — submit a new alternative solution.

import { useParams } from 'next/navigation';
import { parseReconId } from '@/lib/recon-seo';
import AltSubmitForm from './AltSubmitForm';

export default function ReconAltClient() {
  const params = useParams<{ id: string }>();
  const rawSeg = (Array.isArray(params?.id) ? params.id[0] : params?.id) ?? '';
  const id = parseReconId(rawSeg); // strip cosmetic slug suffix → numeric id
  return <AltSubmitForm parentId={id} />;
}
