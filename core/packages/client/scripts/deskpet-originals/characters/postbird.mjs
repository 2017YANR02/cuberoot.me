import { C, p, e, line, face, paper, r } from './art.mjs';
export default { id: 'postbird', number: 15, zh: '折翼邮鸟', en: 'Paperwing Postbird', pixel: false, locomotion: 'flutter', gesture: 'wing', render({ joint: j }) {
  const feet = j('footLeft', p('M100 180v10l-12 4h23l-3-14Z', C.coral), [104, 182]) + j('footRight', p('M137 180v10l-5 4h24l-11-5v-9Z', C.coral), [140, 182]);
  const wing = (side) => side === 'left' ? paper('M87 122Q69 124 55 158L67 154L53 184Q78 174 94 143Z', C.mint) + paper('M82 135L56 178L68 168L63 192Q85 172 93 143Z', C.coral) + paper('M87 126Q74 129 66 148Q82 145 91 136Z', '#94BEAB') : paper('M156 123Q176 136 183 165L174 161L178 180Q156 168 151 139Z', C.coral) + paper('M159 124Q174 132 177 148Q164 144 157 136Z', C.mint);
  const body = p('M84 119Q84 97 121 91Q160 99 161 136L162 166Q145 190 104 183Q77 174 84 119Z', C.mint) + p('M99 127Q126 116 146 132Q168 168 143 179Q102 188 91 166Z', C.cream);
  const head = p('M84 112Q75 71 109 63Q143 54 158 81Q165 97 157 117Z', C.mint) + p('M88 90Q101 72 116 91Q132 68 148 90Q165 113 143 126Q110 139 92 119Z', C.cream) + face(j, {x:121,y:102,gap:19,size:6,smile:false}) + j('mouth', paper('M119 105L127 111L118 119L110 111Z', C.coral), [118,110]) + e(96,116,5,4,C.coral) + e(143,116,5,4,C.coral) + j('earLeft', paper('M111 66Q109 51 94 46Q119 43 128 63Z', C.mint),[121,65]) + j('earRight', paper('M121 65Q132 51 143 56L133 70Z',C.coral),[127,66]);
  const bag = p('M150 124L89 164L87 155L146 117Z','#A6764D') + r(81,152,30,28,'#A6764D',4) + p('M83 153h26l-13 12Z','#C58F64') + line('M91 166h12',C.cream,1.8);
  return j('body', feet + body + j('right', wing('right'), [155,126]) + j('head',head,[121,124]) + bag + j('left',wing('left'),[86,126]),[121,152]);
} };
