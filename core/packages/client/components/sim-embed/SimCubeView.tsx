'use client';

import SharedSimCubeView, { type SimCubeViewProps } from '@cuberoot/timer-ui/SimCubeView';
import { tr, useLang } from '@/i18n/tr';
export type { SimCubeViewProps } from '@cuberoot/timer-ui/SimCubeView';

export default function SimCubeView(props: SimCubeViewProps) {
  const language = useLang();
  return <SharedSimCubeView {...props} language={props.language ?? language} ariaLabel={props.ariaLabel ?? tr({
    zh: '智能魔方实时三维状态（跟随陀螺仪朝向）',
    en: 'Live 3D smart-cube state (follows the gyroscope orientation)',
  })} />;
}
