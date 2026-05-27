'use client';

import { useParams } from 'next/navigation';
import AlgCategoryView from '@/components/AlgCategoryView';
import '../../../alg.css';

export default function AlgSubgroupPage() {
  const params = useParams<{ puzzle: string | string[]; set: string | string[]; subgroup: string | string[] }>();
  const puzzle = Array.isArray(params?.puzzle) ? params.puzzle[0] : (params?.puzzle ?? '');
  const set = Array.isArray(params?.set) ? params.set[0] : (params?.set ?? '');
  const subgroup = Array.isArray(params?.subgroup) ? params.subgroup[0] : (params?.subgroup ?? '');
  return <AlgCategoryView puzzleParam={puzzle} set={set} subgroupParam={subgroup} />;
}
