import { describe, expect, it } from 'vitest';
import { FTO_DRAW_ELEMENTS } from '@/components/puzzle-draw/FtoDrawPanel-data';
import {
  MEGAMINX_EXPANDED_ELEMENTS,
  MEGAMINX_TOP_ELEMENTS,
} from '@/components/puzzle-draw/MegaminxDrawPanel-data';
import { PYRAMINX_DRAW_ELEMENTS } from '@/components/puzzle-draw/PyraminxDrawPanel-data';
import {
  SKEWB_3D_SHAPES,
  SKEWB_NET_SHAPES,
  SKEWB_SIDE_LINES,
} from '@/components/puzzle-draw/skewb-data';
import { SQ1_PRESETS, sq1PieceCounts } from '@/components/puzzle-draw/sq1-data';

describe('authorized puzzle drawing templates', () => {
  it('keeps every supported template at its source geometry count', () => {
    expect(SQ1_PRESETS).toHaveLength(29);
    expect(MEGAMINX_TOP_ELEMENTS).toHaveLength(26);
    expect(MEGAMINX_EXPANDED_ELEMENTS).toHaveLength(31);
    expect(SKEWB_NET_SHAPES).toHaveLength(49);
    expect(SKEWB_3D_SHAPES).toHaveLength(28);
    expect(SKEWB_SIDE_LINES).toHaveLength(12);
    expect(PYRAMINX_DRAW_ELEMENTS).toHaveLength(18);
    expect(FTO_DRAW_ELEMENTS).toHaveLength(73);
  });

  it('keeps every SQ1 preset at one complete 360-degree layer', () => {
    for (const preset of SQ1_PRESETS) {
      const { corners, edges } = sq1PieceCounts(preset.pattern);
      expect(corners * 60 + edges * 30, preset.id).toBe(360);
    }
  });

  it('keeps the FTO body black and excludes it from the 72 paintable stickers', () => {
    const body = FTO_DRAW_ELEMENTS.find((element) => element.key === 'body');
    expect(body).toMatchObject({
      disableDrawing: true,
      disableStrokeWidth: true,
      defaultFill: '#000000',
    });
    expect(FTO_DRAW_ELEMENTS.filter((element) => !element.disableDrawing)).toHaveLength(72);
  });
});
