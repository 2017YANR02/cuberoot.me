'use client';

// /wca/prediction/333 — entry without explicit section (defaults to 'tldr').
// Same component as /wca/prediction/333/[sectionId], sectionId is just undefined.
import Prediction333View from '../_components/Prediction333View';

export default function Prediction333Page() {
  return <Prediction333View />;
}
