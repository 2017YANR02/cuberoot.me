'use client';

import { useParams } from 'next/navigation';
import AlgCategoryView from '@/components/AlgCategoryView';
import '../../alg.css';

export default function AlgSetPage() {
  const params = useParams<{ puzzle: string | string[]; set: string | string[] }>();
  const puzzle = Array.isArray(params?.puzzle) ? params.puzzle[0] : (params?.puzzle ?? '');
  const set = Array.isArray(params?.set) ? params.set[0] : (params?.set ?? '');
  return <AlgCategoryView puzzleParam={puzzle} set={set} />;
}
