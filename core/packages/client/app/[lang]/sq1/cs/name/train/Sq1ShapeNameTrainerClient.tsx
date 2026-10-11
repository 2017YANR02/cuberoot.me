'use client';

import RecognizeTrainer from '@/components/RecognizeTrainer';

export default function Sq1ShapeNameTrainerClient() {
  return (
    <RecognizeTrainer
      algSetId="sq1-shape"
      guideHref="/sq1/cs/name"
      pageTitle={{ zh: 'SQ1 形状命名训练', en: 'Square-1 shape naming drill' }}
      pageIntro={{ zh: '看单层轮廓，答出本站统一名称。', en: 'Name each single-layer silhouette using the site standard.' }}
      showSq1Tools
    />
  );
}
