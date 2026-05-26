'use client';
// /recon/[id]/alt/new — submit a new alternative solution.

import { useParams } from 'next/navigation';
import AltSubmitForm from '../AltSubmitForm';

export default function NewAltPage() {
  const params = useParams<{ id: string }>();
  const id = (Array.isArray(params?.id) ? params.id[0] : params?.id) ?? '';
  return <AltSubmitForm parentId={id} />;
}
