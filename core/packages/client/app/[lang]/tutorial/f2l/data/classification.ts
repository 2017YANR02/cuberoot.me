import type { LocalizedText } from './chapters';

function section(id: string, zh: string, en: string, cases: string): {
  id: string; title: LocalizedText; cases: string[]; recognition?: LocalizedText;
} {
  return { id, title: { zh, en }, cases: cases.split(' ') };
}

// CFOP Tutorial, PDF pages 14–16. A± and B± are taught in the basic-case chapter.
export const F2L_CLASSIFICATION = [
  { title: { zh: '入门', en: 'Introduction' }, sections: [
    section('lbl', '层先', 'Layer by layer', 'E+ E-'),
  ] },
  { title: { zh: '顶层分离', en: 'Separated on top' }, sections: [
    section('split-match', '顶同分离', 'Matching colors, separated', 'W+ W- M+ M-'),
    section('split-nonmatch', '顶异分离', 'Different colors, separated', 'R+ R-'),
    section('twisted', '麻花', 'Twisted pair', 'X+ X-'),
    section('white-top-split', '{bottom}上分离', '{bottom} up, separated', 'P+ P- Q+ Q-'),
  ] },
  { title: { zh: '顶层合并', en: 'Joined on top' }, sections: [
    section('combined-match', '顶同合并', 'Matching colors, joined', 'I+ I-'),
    section('combined-nonmatch', '顶异合并', 'Different colors, joined', 'K+ K-'),
    section('white-top-combined-match', '{bottom}上合并同色', '{bottom} up, joined, matching', 'G+ G-'),
    section('white-top-combined-nonmatch', '{bottom}上合并异色', '{bottom} up, joined, different', 'H+ H-'),
  ] },
  { title: { zh: '一个在槽', en: 'One piece in the slot' }, sections: [
    section('top-corner', '角上棱中', 'Corner on top, edge in slot', 'U+ U- V+ V-'),
    section('white-top-slot-edge', '{bottom}上棱中', '{bottom} up, edge in slot', 'T S'),
    section('slot-corner-front', '角下棱上{bottom}前', 'Corner in slot, {bottom} facing front', 'J+ J-'),
    section('slot-corner-side', '角下棱上{bottom}侧', 'Corner in slot, {bottom} facing sideways', 'L+ L-'),
  ] },
  { title: { zh: '两个都在槽', en: 'Both pieces in the slot' }, sections: [
    section('both-in-slot', '角下棱中', 'Corner and edge in slot', 'F D+ D- C+ C-'),
  ] },
];

export const F2L_CLASSIFICATION_SECTIONS = F2L_CLASSIFICATION.flatMap(group => group.sections);
