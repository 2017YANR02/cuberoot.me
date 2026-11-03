'use client';
import type { CubePhotoArtifact } from '@cuberoot/shared/cube-photo/result';
import { photoRecognitionSets } from '@cuberoot/shared/cube-photo/lookup';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import PhotoAlgorithmCards from './PhotoAlgorithmCards';

export default function PhotoChatResult({ result }: { result: CubePhotoArtifact }) {
  const state = result.status === 'ok' ? result.recognition?.candidates[0] : result.status === 'corners-only' ? result.recognition?.cornerCandidates?.[0] : undefined;
  const applicable = result.recognition ? photoRecognitionSets(result.recognition) : [];
  const partial = result.status === 'partial';
  const href = result.attachmentId ? `/alg/photo?attachment=${encodeURIComponent(result.attachmentId)}` : '/alg/photo';
  return <section className="cube-photo-results" aria-label={result.title}>
    {!state && !(partial && result.results.some(r => r.status === 'found')) && <p role="status">{tr({
      zh: result.status === 'no-grid' ? '未找到完整顶面和两个顶层侧面的网格。' : result.status === 'ambiguous' ? '持方或顶层状态不唯一，需要校正。' : (result.status === 'uncertain-colors' || partial) ? '部分色块不确定，需要校正颜色或网格。' : '识别出的色块无法组成合法顶层，需要校正。',
      en: result.status === 'no-grid' ? 'Could not locate the top face and both side top rows.' : result.status === 'ambiguous' ? 'The orientation or last-layer state is ambiguous.' : (result.status === 'uncertain-colors' || partial) ? 'Some colors are uncertain. Check the colors or grid.' : 'The detected stickers do not form a legal last layer.',
    })}</p>}
    <p className="cube-photo-note">{partial ? tr({ zh: '仅展示所有可能状态均适用的公式；完整状态尚不唯一。', en: 'Only algorithms verified for every possible state are shown; the complete state is still ambiguous.' }) : result.status === 'corners-only' ? tr({ zh: '仅确定顶层角块，棱块与中层状态未推导。', en: 'Only the last-layer corners are determined; edge and middle-layer states are unknown.' }) : tr({ zh: '按标准配色、前两层已复原推导。', en: 'Assumes standard colors and solved first two layers.' })}</p>
    <PhotoAlgorithmCards stateKey={partial ? JSON.stringify(result.recognition?.candidates) : state && ('facelet' in state ? state.facelet : JSON.stringify(state))} sets={result.results.map(r => r.set)} results={Object.fromEntries(result.results.map(r => [r.set, r]))} />
    {state && applicable.length > 0 && result.results.length === 0 && <p>{tr({ zh: '请求的公式类别不适用于当前状态。', en: 'The requested algorithm sets do not apply to this state.' })}</p>}
    <AppLink href={href} prefetch={false}>{tr({ zh: '打开图片识别与校正', en: 'Open image recognition and correction' })}</AppLink>
  </section>;
}
