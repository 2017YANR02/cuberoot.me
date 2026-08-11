'use client';

import AlgCategoryView, { type AlgCategoryViewProps } from '@/components/AlgCategoryView';
import { isSimpleZbllCase } from '@/lib/alg_simple_zbll';
import '../../../alg.css';

const SIMPLE_ZBLL: NonNullable<AlgCategoryViewProps['collection']> = {
  heading: { zh: '简单 ZBLL', en: 'Simple ZBLL' },
  intro: {
    zh: '收录最优 HTM 不超过 10 步的情况，以及四面合计至少有 4 组相邻同色、较容易观察的情况。',
    en: 'Cases with an optimal HTM of 10 or less, plus longer cases with at least four adjacent same-colour pairs around the sides.',
  },
  backHref: '/alg/3x3/zbll',
  sourcePath: '/alg/3x3/zbll/simple',
  filename: '3x3-simple-zbll',
  include: isSimpleZbllCase,
  cardsOnly: true,
  simplifiedByDefault: true,
};

export default function SimpleAlgSetClient() {
  return <AlgCategoryView puzzleParam="3x3" set="zbll" collection={SIMPLE_ZBLL} />;
}
