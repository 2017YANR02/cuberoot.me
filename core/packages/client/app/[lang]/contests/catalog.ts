import { eventDisplayName } from '@/lib/wca-events';
import type { ContestEvent } from '@/lib/contests-api';
import type { Msg } from '@/i18n/tr';

export const CONTEST_GROUPS: Record<string, Msg> = {
  main: { zh: '主要非官方项目', en: 'Main events' }, wca: { zh: 'WCA 项目', en: 'WCA events' },
  'extreme-bld': { zh: '极限盲拧', en: 'Extreme blindfolded' }, side: { zh: '趣味项目', en: 'Side events' },
  challenge: { zh: '挑战项目', en: 'Challenge events' }, team: { zh: '团队项目', en: 'Team events' },
  relay: { zh: '接力项目', en: 'Relay events' }, order: { zh: '阶数变体', en: 'Order variations' },
};
export const CONTEST_TYPES: Record<string, Msg> = {
  comp: { zh: '非官方比赛', en: 'Unofficial competition' }, 'wca-comp': { zh: 'WCA 比赛附加项目', en: 'WCA side events' },
  meetup: { zh: '聚会', en: 'Meetup' }, online: { zh: '线上成绩', en: 'Online results' },
};

// Only external IDs that differ from our existing puzzle catalog need aliases.
const aliases: Record<string, string> = {
  redi: 'redi_cube', mpyram: 'mpyram', ivy_cube: 'ivy', '333_mirror_blocks': 'mirror',
  '333_mirror_blocks_bld': 'mirror_bld', '333_void': 'void', '333_axis_cube': 'axis',
  '333_windmill_cube': 'windmill', '333_twist_cube': 'twisty',
};
// RecordRanks-specific competitions have no equivalent in the puzzle catalog.
const labels: Record<string, string> = {
  fto: '转面八面体', mpyram: '四阶金字塔', kilominx: '二阶五魔', redi: 'Redi',
  '333_team_bld': '三阶双人盲拧', '333_mirror_blocks': '镜面', '333_mirror_blocks_bld': '镜面盲拧',
  '333_linear_fm': '三阶线性最少步', '333_speed_bld': '三阶速盲', '333mts': '三阶匹配打乱',
  miniguild: '迷你 Guildford 接力', miniguild_2_person: '双人迷你 Guildford 接力',
  sq1_mbo: 'SQ1 多盲', '2345relay_bld': '二至五阶接力盲拧', '234567relay_bld': '二至七阶接力盲拧',
  '2345678relay_bld': '二至八阶接力盲拧', miniguild_bld: '迷你 Guildford 接力盲拧',
  minx_bld: '五魔盲拧', minx444_bld: '四阶五魔盲拧', minx555_bld: '五阶五魔盲拧',
  minx2345relay_bld: '二至五阶五魔接力盲拧', pyram_crystal_bld: '水晶金字塔盲拧',
  '333_team_bld_old': '三阶双人盲拧（含观察）', '333_team_factory': '三阶团队工厂',
  '333_one_move_team_factory': '三阶单步团队工厂', '333_inspectionless': '三阶无观察',
  '333bf_oh': '三阶单手盲拧', '333_scrambling': '三阶打乱', '333_assembly': '三阶组装',
  '333_upside_down_vision': '三阶倒置视野', '333oh_x2': '三阶双单手', '333_oven_mitts': '三阶烤箱手套',
  '333_paw_mitts': '三阶爪形手套', '333_doubles': '三阶双人协作', '333_one_side': '三阶单面',
  '333_supersolve': '三阶 Supersolve', '333_bets': '三阶 Bets', '333_cube_mile': '三阶魔方英里',
  '333_braille_bld': '三阶盲文盲拧', '333_siamese': '三阶连体', gear_cube: '齿轮', super_gear_cube: '超级齿轮',
  '333bf_bottle': '三阶绿茶盲拧', '333oh_bottle': '三阶 H2OH',
  '333_team_bld_twist': '三阶特殊双人盲拧', '333_team_bld_twist_cnc': '三阶魔友与非魔友双人盲拧',
  '222_squared': '二阶 Squared', clock_bld: '魔表盲拧', clock_oh: '魔表单手', clock_mbld: '魔表多盲',
  clock_doubles: '魔表双人协作', minx_oh: '五魔单手', pyram_oh: '金字塔单手', skewb_oh: '斜转单手',
  sq1_bld: 'SQ1 盲拧', sq1_oh: 'SQ1 单手', '222_mirror_blocks': '二阶镜面',
  pyramorphix: '二阶粽子', mmorphix: '三阶粽子', '444_mirror_blocks': '四阶镜面', '555_mirror_blocks': '五阶镜面',
  mkilominx: '四阶五魔', gigaminx: '五阶五魔', '2pentahedron': '二阶五面体', '3pentahedron': '三阶五面体',
  '222_blanker': '二阶空白', '333_void': '三阶空心', fisher: '三阶移棱', '333_twist_cube': '三阶扭曲',
  '333_windmill_cube': '三阶风车', '333_axis_cube': '三阶轴', baby_fto: '二阶转面八面体',
  fto_bld: '转面八面体盲拧', fto_mbld: '转面八面体多盲', mfto: '四阶转面八面体', cto: '转角八面体',
  dino: '恐龙', ivy_cube: '枫叶', corner_heli222: '二阶转角直升机', helicopter: '直升机',
  curvycopter: '曲线直升机', rainbow_cube: '彩虹', pyram_duo: '二重奏金字塔', magic_oh: '八板单手',
  '15puzzle': '十五数码', '8puzzle': '八数码', snake: '魔尺', '360_puzzle': '360',
  penta_clock: '超级五边形魔表', new_penta_clock: '新式五边形魔表', super_133: '超级 133',
  '223_banana': '223 香蕉', '234relay': '二至四阶接力', '2345relay': '二至五阶接力',
  '234567relay': '二至七阶接力', '234567relay_2_person': '双人二至七阶接力',
  '333bf_2_person_relay': '三阶双人盲拧接力', '333bf_3_person_relay': '三阶三人盲拧接力',
  '333bf_4_person_relay': '三阶四人盲拧接力', '333bf_8_person_relay': '三阶八人盲拧接力',
  '333_oh_bld_team_relay': '三阶、单手与盲拧团队接力', miniguild_3_person: '三人迷你 Guildford 接力',
  miniguild_oh: '迷你 Guildford 单手接力', jing_pyraminx: 'Jing 金字塔', tri_clock: '三角魔表',
};

export function contestEventName(event: ContestEvent, isZh: boolean): string {
  const canonical = aliases[event.eventId] ?? event.eventId;
  const existing = eventDisplayName(canonical, isZh);
  if (existing !== canonical) return existing;
  if (!isZh) return event.name;
  if (labels[event.eventId]) return labels[event.eventId];
  // Display-only regular patterns; never alter API IDs or stored source names.
  const cube = /^(\d+)x\1x\1 (Cube|Blindfolded|Multi-Blind|Fewest Moves|One-Handed|With Feet)$/.exec(event.name);
  if (cube) return `${cube[1]}阶${({ Cube: '', Blindfolded: '盲拧', 'Multi-Blind': '多盲', 'Fewest Moves': '最少步', 'One-Handed': '单手', 'With Feet': '脚拧' } as Record<string, string>)[cube[2]]}`;
  const cuboid = /^(\d+)x(\d+)x(\d+) Cuboid$/.exec(event.name);
  return cuboid ? `${cuboid[1]}${cuboid[2]}${cuboid[3]}` : event.name;
}

