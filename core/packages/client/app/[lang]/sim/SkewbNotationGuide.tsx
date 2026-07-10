'use client';
import { useState, useCallback } from 'react';
import { BookOpen, RotateCcw } from 'lucide-react';
import { useT } from '@/hooks/useT';
import type { SkewbNotation } from '@cuberoot/shared/skewb-notation';

/**
 * Skewb notation guide (engine renderer only). WCA and Sarah put different letters on
 * the same 8 corners, so a table alone is unclear — this lets you tap any letter and
 * watch the actual twist on the main cube (from solved; your scramble/solution text is
 * untouched and one tap of "Back to my cube" rebuilds it). Sarah's S/H play out as
 * their real sledge/hedge sequences and x/y/z show the whole-cube reorientation —
 * things a static diagram can't convey.
 */

const CORNER = {
  UFR: { zh: '上前右', en: 'up-front-right' },
  ULF: { zh: '上前左', en: 'up-front-left' },
  URB: { zh: '上后右', en: 'up-back-right' },
  ULB: { zh: '上后左', en: 'up-back-left' },
  DFR: { zh: '下前右', en: 'down-front-right' },
  DLF: { zh: '下前左', en: 'down-front-left' },
  DRB: { zh: '下后右', en: 'down-back-right' },
  DLB: { zh: '下后左', en: 'down-back-left' },
} as const;

type CornerName = keyof typeof CORNER;
interface Tok { t: string; corner?: CornerName; kind: 'corner' | 'macro' | 'rot'; }

const c = (t: string, corner: CornerName): Tok => ({ t, corner, kind: 'corner' });

function tokenRows(n: SkewbNotation): { top: Tok[]; bot: Tok[]; extra: Tok[] } {
  if (n === 'sarah') {
    return {
      top: [c('F', 'UFR'), c('L', 'ULF'), c('R', 'URB'), c('B', 'ULB')],
      bot: [c('d', 'DFR'), c('l', 'DLF'), c('r', 'DRB'), c('b', 'DLB')],
      extra: [
        { t: 'S', kind: 'macro' }, { t: 'H', kind: 'macro' },
        { t: 'x', kind: 'rot' }, { t: 'y', kind: 'rot' }, { t: 'z', kind: 'rot' },
      ],
    };
  }
  return {
    top: [c('F', 'UFR'), c('UL', 'ULF'), c('UR', 'URB'), c('U', 'ULB')],
    bot: [c('D', 'DFR'), c('L', 'DLF'), c('R', 'DRB'), c('B', 'DLB')],
    extra: [],
  };
}

interface Props {
  notation: SkewbNotation;
  /** Play this token on the main cube from solved. */
  onDemo: (token: string) => void;
  /** Rebuild the user's scramble/solution on the cube. */
  onRestore: () => void;
}

export default function SkewbNotationGuide({ notation, onDemo, onRestore }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Tok | null>(null);

  const describe = useCallback((tok: Tok): string => {
    if (tok.kind === 'corner' && tok.corner) {
      const cc = CORNER[tok.corner];
      return t(`${tok.t} — ${cc.zh}角,顺时针 120°(加 ' 反向)`,
        `${tok.t} — ${cc.en} corner, 120° clockwise (add ' to reverse)`);
    }
    if (tok.kind === 'macro') {
      return tok.t === 'S'
        ? t("S — 抽杆 sledgehammer(F' L F L')", "S — sledgehammer (F' L F L')")
        : t("H — 反抽杆 hedgeslammer(L F' L' F)", "H — hedgeslammer (L F' L' F)");
    }
    return t(`${tok.t} — 整体旋转`, `${tok.t} — whole-cube rotation`);
  }, [t]);

  const demo = useCallback((tok: Tok) => { setActive(tok); onDemo(tok.t); }, [onDemo]);
  const restore = useCallback(() => { setActive(null); onRestore(); }, [onRestore]);

  const { top, bot, extra } = tokenRows(notation);

  const chip = (tok: Tok) => (
    <button
      key={tok.t}
      type="button"
      className={`skewb-guide-chip${active?.t === tok.t ? ' is-active' : ''}`}
      onClick={() => demo(tok)}
      title={describe(tok)}
    >{tok.t}</button>
  );

  return (
    <div className="skewb-guide">
      <button
        type="button"
        className="skewb-guide-toggle"
        aria-expanded={open}
        onClick={() => { if (open && active) restore(); setOpen((o) => !o); }}
      >
        <BookOpen size={13} />
        {t('记号指南', 'Notation guide')}
      </button>
      {open && (
        <div className="skewb-guide-body">
          <p className="skewb-guide-caption">
            {active ? describe(active) : t('点字母,看它在魔方上转哪个角', 'Tap a letter to see which corner it turns')}
          </p>
          <div className="skewb-guide-grid">
            <span className="skewb-guide-label">{t('上层', 'Top')}</span>
            <div className="skewb-guide-chips">{top.map(chip)}</div>
            <span className="skewb-guide-label">{t('底层', 'Bottom')}</span>
            <div className="skewb-guide-chips">{bot.map(chip)}</div>
            {extra.length > 0 && (
              <>
                <span className="skewb-guide-label">{t('宏 / 旋转', 'Macros / rotations')}</span>
                <div className="skewb-guide-chips">{extra.map(chip)}</div>
              </>
            )}
          </div>
          {active && (
            <button type="button" className="skewb-guide-restore" onClick={restore}>
              <RotateCcw size={12} />{t('回到我的魔方', 'Back to my cube')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
