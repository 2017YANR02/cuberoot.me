'use client';

/**
 * SpeffzSchemeView — /tutorial/speffz-letter-scheme 的「精美版」:
 * 手绘 SVG 复刻原 docx 的彩色 Speffz 展开图 + 完整编码规则文字(2 阶到 NxN)。
 * 字母计算在 _lib/speffz.ts(已逐格核对原 docx 全部展开表)。
 */
import { useState } from 'react';
import { tr, T } from '@/i18n/tr';
import { diagramTypesFor, type DiagramType, type SpeffzFace } from '../../_lib/speffz';
import { SpeffzMasterNet, SpeffzNet, SPEFFZ_FILL } from './SpeffzNets';
import './speffz.css';

const DIAGRAM_LABEL: Record<DiagramType, { en: string; zh: string }> = {
  'x-center': { en: 'X-Centers', zh: 'X 心' },
  'plus-center': { en: '+-Centers', zh: '十字心' },
  oblique: { en: 'Obliques', zh: '斜心' },
  wing: { en: 'Wings', zh: '翼棱' },
  corner: { en: 'Corners', zh: '角块' },
  edge: { en: 'Edges', zh: '棱块' },
  midge: { en: 'Midges', zh: '中棱' },
  all: { en: 'All pieces', zh: '全部贴纸' },
};

const FACE_WORD: Record<SpeffzFace, { en: string; zh: string }> = {
  U: { en: 'Up', zh: '上' },
  L: { en: 'Left', zh: '左' },
  F: { en: 'Front', zh: '前' },
  R: { en: 'Right', zh: '右' },
  B: { en: 'Back', zh: '后' },
  D: { en: 'Down', zh: '底' },
};

/** 3x3 字母 ↔ 位置对照(角块 = 该字母所在角块,棱块 = 所在棱块),按面分组。 */
const LETTER_TABLE: { face: SpeffzFace; rows: [string, string, string][] }[] = [
  { face: 'U', rows: [['A', 'UBL', 'UB'], ['B', 'UBR', 'UR'], ['C', 'UFR', 'UF'], ['D', 'UFL', 'UL']] },
  { face: 'L', rows: [['E', 'UBL', 'UL'], ['F', 'UFL', 'FL'], ['G', 'DFL', 'DL'], ['H', 'DBL', 'BL']] },
  { face: 'F', rows: [['I', 'UFL', 'UF'], ['J', 'UFR', 'FR'], ['K', 'DFR', 'DF'], ['L', 'DFL', 'FL']] },
  { face: 'R', rows: [['M', 'UFR', 'UR'], ['N', 'UBR', 'BR'], ['O', 'DBR', 'DR'], ['P', 'DFR', 'FR']] },
  { face: 'B', rows: [['Q', 'UBR', 'UB'], ['R', 'UBL', 'BL'], ['S', 'DBL', 'DB'], ['T', 'DBR', 'BR']] },
  { face: 'D', rows: [['U', 'DFL', 'DF'], ['V', 'DFR', 'DR'], ['W', 'DBR', 'DB'], ['X', 'DBL', 'DL']] },
];

const ORDERS = [2, 3, 4, 5, 6, 7];

export function SpeffzSchemeView() {
  const [order, setOrder] = useState(3);

  return (
    <div className="speffz-view">
      <h1>{tr({ zh: 'Speffz 字母编码', en: 'Speffz Letter Scheme' })}</h1>
      <p className="speffz-lead">
        {tr({
          zh: '盲拧通用的贴纸字母方案:六个面按 U L F R B D 顺序各占 4 个字母,共 A–X 24 个;每类块的每条轨道独立复用同一份 24 字母。本页给出从 2 阶到任意 NxN 的完整编码规则与彩色展开图。',
          en: 'The standard sticker lettering scheme for blindfolded solving: the six faces, in U L F R B D order, take four letters each — 24 letters A–X in total — and every orbit of every piece type independently reuses the same 24 letters. This page states the full rules and draws the colored nets from 2x2 up to any NxN.',
        })}
      </p>

      <section>
        <h2>{tr({ zh: '什么是 Speffz', en: 'What is Speffz' })}</h2>
        <p>
          {tr({
            zh: 'Speffz 得名于 speedsolving.com 论坛用户 Speffz,是 speedsolving wiki 与绝大多数盲拧教程默认的字母方案。它把「贴纸位置」映射为字母:盲拧记忆时,把要送达的目标位置依次读成字母序列,再两两组成字母对(letter pair),编成词语或图像来记忆。',
            en: 'Named after the speedsolving.com forum user Speffz, it is the default letter scheme of the speedsolving wiki and most blindfolded tutorials. It maps sticker positions to letters: while memorising, the solve targets are read off as a letter sequence and chunked into letter pairs, each encoded as a word or image.',
          })}
        </p>
      </section>

      <section>
        <h2>{tr({ zh: '主图:每面四个象限', en: 'Master diagram: four quadrants per face' })}</h2>
        <p>
          <T
            zh={<>展开图布局:U 在上,L F R 在中排,D 在下;<strong>B 面单独放在右上角,按 y2 视角绘制</strong>(整体绕竖轴转 180° 后正视 B 面),而不是向上翻折。每面分成 4 个象限,依次写入该面的 4 个字母。</>}
            en={<>Net layout: U on top, L F R in the middle row, D at the bottom; <strong>the B face sits alone at the top right, drawn as seen from y2</strong> (turn the whole cube 180° about the vertical axis and view B head-on) rather than folded upwards. Each face splits into four quadrants holding the face&apos;s four letters.</>}
          />
        </p>
        <div className="speffz-figrow">
          <figure className="speffz-fig">
            <SpeffzMasterNet odd={false} label={tr({ zh: '偶数阶 Speffz 主图', en: 'Even order Speffz master diagram' })} />
            <figcaption>{tr({ zh: '偶数阶:每面均分四象限', en: 'Even orders: four equal quadrants' })}</figcaption>
          </figure>
          <figure className="speffz-fig">
            <SpeffzMasterNet odd label={tr({ zh: '奇数阶 Speffz 主图', en: 'Odd order Speffz master diagram' })} />
            <figcaption>{tr({ zh: '奇数阶:绕固定中心的风车形象限,中心无字母', en: 'Odd orders: pinwheel quadrants around the fixed center, which gets no letter' })}</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <h2>{tr({ zh: '编码规则(3 阶直到 NxN)', en: 'The rules (3x3 up to NxN)' })}</h2>
        <ol className="speffz-rules">
          <li>
            <T
              zh={<><strong>面顺序与字母段:</strong>U=A–D,L=E–H,F=I–L,R=M–P,B=Q–T,D=U–X。</>}
              en={<><strong>Face order and letter ranges:</strong> U=A–D, L=E–H, F=I–L, R=M–P, B=Q–T, D=U–X.</>}
            />
          </li>
          <li>
            <T
              zh={<><strong>面内顺时针:</strong>正视每个面,4 个字母按象限顺时针分布——左上第 1、右上第 2、右下第 3、左下第 4(如 U 面为 A B / D C)。偶数阶四象限均分;奇数阶是绕固定中心的风车形(见主图)。任意贴纸的字母 = 该面首字母 + 所在象限序号。</>}
              en={<><strong>Clockwise within a face:</strong> viewing the face head-on, its four letters fill the quadrants clockwise — 1st top-left, 2nd top-right, 3rd bottom-right, 4th bottom-left (the U face reads A B / D C). Even orders split into four equal quadrants; odd orders use the pinwheel shape around the fixed center (see the master diagram). Any sticker&apos;s letter = the face&apos;s first letter + its quadrant index.</>}
            />
          </li>
          <li>
            <T
              zh={<><strong>B 面从 y2 看:</strong>把整个魔方绕竖轴转 180° 后正视 B 面(此时视线左侧是 R 面),再套同一象限规则。</>}
              en={<><strong>View B from y2:</strong> rotate the whole cube 180° about the vertical axis, view B head-on (the R face is now on your left), then apply the same quadrant rule.</>}
            />
          </li>
          <li>
            <T
              zh={<><strong>轨道独立:</strong>角块、棱块/中棱、每一圈翼棱、每一圈 X 心、每一圈十字心、每种斜心……每条轨道各自独立套一份完整 A–X。同一面上不同轨道会出现相同字母(如 6 阶翼棱图的 U 面顶边有两个 A);互为镜像的左右斜心也各套一份,均用大写。</>}
              en={<><strong>Orbits are independent:</strong> corners, edges/midges, each wing ring, each X-center ring, each +-center ring, each oblique kind — every orbit gets its own full copy of A–X. Different orbits repeat the same letters on one face (the 6x6 wing net has two A&apos;s along the top edge of U), and the two mirror-image oblique orbits each take a copy, both in capitals.</>}
            />
          </li>
          <li>
            <T
              zh={<><strong>无字母贴纸:</strong>奇数阶的固定中心不编码。翼棱块有两张贴纸,只给一张编码:沿该面顺时针方向,位于每条边前半段的贴纸有字母,后半段的(half wing)留空。判定式:设面为 n 阶、贴纸距顺时针方向前一个角 d 格,则 d &lt; n−1−d 有字母,d &gt; n−1−d 留空(d = n−1−d 时是中棱)。每个翼棱块恰好有一张带字母的贴纸。</>}
              en={<><strong>Stickers without letters:</strong> fixed centers on odd cubes get none. Each wing piece has two stickers but only one letter: going clockwise around a face, wing stickers on the leading half of each edge are lettered, those on the trailing half (the half wings) stay blank. Formally, on an n-layer face with d = the sticker&apos;s distance from the preceding corner clockwise: lettered if d &lt; n−1−d, blank if d &gt; n−1−d (d = n−1−d is the midge). Every wing piece ends up with exactly one lettered sticker.</>}
            />
          </li>
          <li>
            <T
              zh={<><strong>用途:</strong>解法目标依次读成字母后,相邻两个组成一个字母对(letter pair)编词记忆。</>}
              en={<><strong>Usage:</strong> read the solve targets as letters, then chunk neighbouring pairs into letter pairs for memorisation.</>}
            />
          </li>
        </ol>
      </section>

      <section>
        <h2>{tr({ zh: '3 阶字母对照表', en: '3x3 letter reference' })}</h2>
        <p>
          {tr({
            zh: '每个字母落在哪个块上(角块列 = 该字母所在的角块,棱块列 = 所在棱块)。更高阶的中棱、翼棱位于相同的棱位;各类中心块按象限规则类推。',
            en: 'Which piece each letter lands on (corner column = the corner holding that letter, edge column = the edge). On bigger cubes midges and wings sit on the same edge positions; center pieces follow the quadrant rule.',
          })}
        </p>
        <div className="speffz-table-wrap">
          <table className="speffz-table">
            <thead>
              <tr>
                <th>{tr({ zh: '面', en: 'Face' })}</th>
                <th>{tr({ zh: '字母', en: 'Letter' })}</th>
                <th>{tr({ zh: '角块', en: 'Corner' })}</th>
                <th>{tr({ zh: '棱块', en: 'Edge' })}</th>
              </tr>
            </thead>
            <tbody>
              {LETTER_TABLE.map(({ face, rows }) =>
                rows.map(([letter, corner, edge], i) => (
                  <tr key={letter}>
                    {i === 0 && (
                      <td rowSpan={4} className="speffz-facecell">
                        <span className="speffz-swatch" style={{ background: SPEFFZ_FILL[face] }} />
                        {face} {tr(FACE_WORD[face])}
                      </td>
                    )}
                    <td className="speffz-mono"><strong>{letter}</strong></td>
                    <td className="speffz-mono">{corner}</td>
                    <td className="speffz-mono">{edge}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>{tr({ zh: '各阶展开图', en: 'Nets by cube size' })}</h2>
        <div className="speffz-order-row">
          <label htmlFor="speffz-order">{tr({ zh: '阶数', en: 'Cube size' })}</label>
          <select
            id="speffz-order"
            className="speffz-select"
            value={order}
            onChange={e => setOrder(Number(e.target.value))}
          >
            {ORDERS.map(n => (
              <option key={n} value={n}>{n}x{n}</option>
            ))}
          </select>
        </div>
        <div className="speffz-figrow">
          {diagramTypesFor(order).map(diagram => {
            const caption = tr(DIAGRAM_LABEL[diagram]);
            return (
              <figure className="speffz-fig" key={diagram}>
                <SpeffzNet n={order} diagram={diagram} label={caption} />
                <figcaption>{caption}</figcaption>
              </figure>
            );
          })}
        </div>
        <p className="speffz-note">
          {tr({
            zh: '高于 7 阶按同样规则类推:每多一圈,翼棱与各类中心块各多出一条轨道,各自再套一份 A–X。11x11、12x12 的参考图见「原始版」视图。',
            en: 'Above 7x7 the same rules extend: each extra ring adds one more orbit of wings and of each center type, each taking its own copy of A–X. See the “Original” view for the 11x11 and 12x12 reference images.',
          })}
        </p>
      </section>
    </div>
  );
}
