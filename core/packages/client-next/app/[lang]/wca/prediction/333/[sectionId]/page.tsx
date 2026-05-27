'use client';

// /wca/prediction/333/[sectionId] — same Prediction333View, sectionId from URL params.
// Next 16: params is a Promise — unwrap with React.use().
import { use } from 'react';
import Prediction333View from '../../_components/Prediction333View';

export default function Prediction333SectionPage({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const { sectionId } = use(params);
  return <Prediction333View sectionId={sectionId} />;
}
