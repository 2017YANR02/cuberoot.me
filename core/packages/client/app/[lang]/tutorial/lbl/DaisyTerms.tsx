import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';

const scheme = orientedCubeFaceColors('z2');
const ignored = FM_FIXED_COLOR[FM_IGNORED]!;
const stickers = Array<string>(54).fill(ignored);
for (const index of [1, 3, 5, 7]) stickers[index] = scheme.D;
stickers[4] = scheme.U;

export function DaisyFace({ size }: { size: number }) {
  return <VisualCube local view="plan" size={size} stickerColors={stickers} stickerMaskColor={ignored} alt="" />;
}

export function DaisyTerms() {
  return <>
    <div className="lbl-daisy-cycle" aria-hidden="true">
      <svg viewBox="0 0 180 180" fill={scheme.D}>
        {[0, 90, 180, 270].map(angle => (
          <g key={angle} transform={`rotate(${angle} 90 90)`}>
            <path d="M90 89C76 80 63 57 63 38L64 26Q65 8 81 6Q90 5 100 6Q115 8 116 26L117 38C117 57 104 80 90 89Z" stroke={ignored} strokeOpacity=".45" />
            <path d="M90 72Q86 47 90 17M86 70Q76 49 77 28M94 70Q104 47 103 29"
              fill="none" stroke={ignored} strokeOpacity=".18" strokeLinecap="round" />
          </g>
        ))}
        <circle cx="90" cy="90" r="23" fill={scheme.U} stroke={ignored} strokeOpacity=".35" />
      </svg>
      <DaisyFace size={440} />
    </div>
    <p className="lbl-lead">{tr({
      zh: '花蕊：黄色中心块，花瓣：白色棱块',
      en: 'Flower center: yellow center piece. Petals: white edge pieces.',
    })}</p>
  </>;
}
