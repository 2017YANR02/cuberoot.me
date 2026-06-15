'use client';

// /wca/prediction/333/[sectionId] — same Prediction333View, sectionId from URL params.
// Reads the slug client-side via useParams() so the route can prerender force-static.
import { useParams } from 'next/navigation';
import Prediction333View from '../../_components/Prediction333View';

export default function Prediction333SectionClient() {
  const params = useParams<{ sectionId: string | string[] }>();
  const sectionId = (Array.isArray(params?.sectionId) ? params.sectionId[0] : params?.sectionId) ?? '';
  return <Prediction333View sectionId={sectionId} />;
}
