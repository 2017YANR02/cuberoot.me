/*
 * Shape mods of the 3x3x3 — physically different cubes (sticker layout / face
 * shapes) but cubically identical: they all use the WCA 333 scramble. We
 * expose them as separate selector entries so users can pick the shape and
 * see it labeled correctly, while routing scramble generation back to the
 * 333 pool — no extra scramble engine work.
 *
 * (Mastermorphix is the 3x3 shape mod; the 2x2 cousin "Pyramorphix" uses
 * 2x2 scramble — kept here for the 3x3 cubing-icons glyph but routed
 * carefully. We skip the 2x2 mod for now since it's rarely demanded.)
 */

export interface ShapeModEvent {
  id: string;
  /** WCA event id whose scramble pool we borrow from. Almost always '333'. */
  scrambleSourceId: string;
  iconClass?: string;
  textLabel?: string;
  zh: string;
  en: string;
  zhHant?: string;
}

export const SHAPE_MOD_EVENTS: ReadonlyArray<ShapeModEvent> = [
  { id: 'mirror_333',       scrambleSourceId: '333', zh: '镜面魔方',     en: 'Mirror Blocks',   iconClass: 'unofficial-333_mirror_blocks'
},
  { id: 'pyramorphix',      scrambleSourceId: '222', zh: '二阶金字塔',   en: 'Pyramorphix',     iconClass: 'unofficial-pyramorphix'
},
  { id: 'mastermorphix',    scrambleSourceId: '333', zh: '三阶金字塔',   en: 'Mastermorphix',   textLabel: 'MMx'
},
  { id: 'fisher_333',       scrambleSourceId: '333', zh: '费舍尔魔方',   en: 'Fisher Cube',     iconClass: 'unofficial-fisher'
},
  { id: 'axis_333',         scrambleSourceId: '333', zh: '轴方',         en: 'Axis Cube',       textLabel: 'Axis'
},
  { id: 'windmill_333',     scrambleSourceId: '333', zh: '风火轮',       en: 'Windmill',        textLabel: 'Wind'
},
  { id: 'ghost_333',        scrambleSourceId: '333', zh: '幽灵魔方',     en: 'Ghost Cube',      textLabel: 'Ghost'
},
  { id: 'void_333',         scrambleSourceId: '333', zh: '空心魔方',     en: 'Void Cube',       textLabel: 'Void' },
];

const BY_ID = new Map(SHAPE_MOD_EVENTS.map((e) => [e.id, e] as const));

export const SHAPE_MOD_EVENT_IDS: ReadonlySet<string> = new Set(SHAPE_MOD_EVENTS.map((e) => e.id));

export const SHAPE_MOD_APPEND: ReadonlyArray<{ id: string; iconClass: string; label?: string; textLabel?: string }> =
  SHAPE_MOD_EVENTS.map((e) => ({
    id: e.id,
    iconClass: e.iconClass ?? '',
    textLabel: e.iconClass ? undefined : e.textLabel,
  }));

export function isShapeModEvent(id: string): boolean {
  return SHAPE_MOD_EVENT_IDS.has(id);
}

/** Source WCA event whose scramble to actually generate. */
export function shapeModSourceEvent(id: string): string | null {
  return BY_ID.get(id)?.scrambleSourceId ?? null;
}

export function shapeModDisplayName(id: string, isZh: boolean): string | null {
  const e = BY_ID.get(id);
  if (!e) return null;
  return isZh ? e.zh : e.en;
}
