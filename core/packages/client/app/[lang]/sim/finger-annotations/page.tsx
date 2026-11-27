'use client';

import { Fragment } from 'react';
import { ArrowUpRight } from 'lucide-react';
import AppLink from '@/components/AppLink';
import PageHeading from '@/components/PageHeading';
import { useT } from '@/hooks/useT';
import { CUBE_FACE_LETTERS, unfoldedGrid } from '@cuberoot/shared/cube-unfolded-svg';
import { CUBE_FILL, CUBE_ON_FILL } from '@/lib/cube-colors';
import { stickerLetter } from '../../tutorial-legacy/_lib/speffz';
import FingerAnnotationExample, { pinExampleHref } from '../FingerAnnotationExample';
import './guide.css';

type SymbolEntry = readonly [example: string | readonly string[], zh: string, en: string];

const fingers: SymbolEntry[] = [
  [['R1', 'L1'], 'R 是右手，L 是左手。1 是拇指，因此 L1 指左手拇指。', 'R means right hand and L means left hand. The thumb is 1, so L1 is the left thumb.'],
  [['R2', 'R3'], '2 是食指，3 是中指。食指起拨、中指接力时，先写 R2 的动作，再写 R3 的动作。', '2 is the index finger and 3 is the middle finger. For a right index–middle relay, describe the R2 stroke and then the R3 stroke.'],
  [['L4', 'L5'], '4 是无名指，5 是小指。L4 指左手无名指，L5 指左手小指。', '4 is the ring finger and 5 is the little finger. L4 and L5 identify those fingers on the left hand.'],
  [['Rh', 'Lh'], '小写 h 表示整只手。Rh 指整个右手，Lh 指整个左手。', 'Lowercase h designates the whole hand. Rh is the entire right hand and Lh the entire left.'],
];

const contact: SymbolEntry[] = [
  ['Q>M', '从 Q 到 M。直接写字母表示指尖沿魔方表面移动，途中可以滑过贴纸。', 'Travel from Q to M. With no contact prefix, the fingertip stays on the surface and may slide across stickers.'],
  ['@C>Q', '@ 指定固定接触点。先按住 C，转层带着贴纸和指尖一起到 Q。', '@ pins the fingertip to one spot. Press C and let the turning layer carry both the sticker and the fingertip to Q.'],
  ['~Q>M', '~ 后跟贴纸字母，表示手指在空中沿这段路径移动。也可在中途改变接触方式，例如 Q>~M 表示从 Q 向 M 移动时离面。', 'A tilde before a sticker letter describes a free path through the air. A path can change contact mode midway. In Q>~M the finger leaves the surface on its way to M.'],
  ['~', '~ 单独出现表示指尖从当前位置抬起。可在后面写避让方向和距离；省略距离时使用该动作的默认值。', 'A tilde on its own lifts the finger from its current position. Add a direction and an optional distance to describe how it clears the layer. Omit the distance to use the motion’s default.'],
  [['~+x', '~-z'], '正负号选择坐标轴方向。+x 向右，+y 向上，+z 向前，负号取反。例如 ~-z 表示向后避让。', 'The sign selects an axis direction. Positive x is right, positive y is up and positive z is front. A minus sign reverses it, so ~-z clears toward the back.'],
  ['~B^1.5', '^ 表示垂直于指定面向外抬起。U、D、L、R、F、B 依次是上、下、左、右、前、背面。这个例子是从背面向外移 1.5 个模型长度单位。', 'The caret points straight out from the named face. U, D, L, R, F and B mean up, down, left, right, front and back. Here the finger moves outward from the back face by 1.5 model units.'],
];

const moveMarks: SymbolEntry[] = [
  [["U'", 'U2'], '转动字母后的单引号表示逆时针，2 表示半圈。U2 是顶层转 180°。括号内的 R2 则按右手食指来读。', 'An apostrophe after the move reverses its direction, and 2 means a half turn. U2 turns the upper layer 180°. Inside the brackets, R2 identifies the right index finger.'],
  [['↑R', '↓F', '·U'], '转动前的 ↑、↓、· 分别选上、下、中起手。单个握姿紧贴下一转动时用右手，后面留空格时用左手。例如 ↓F 是右手下起手，↓ F 是左手下起手，再做 F。', 'Before a move, ↑ selects an up grip, ↓ a down grip and · the home grip. Attach a single grip mark to the next move for the right hand, or separate it with a space for the left. Compare ↓F and ↓ F.'],
  [['↑↑U', '↓↓U'], '同方向的两个箭头表示同一只手转半圈到起手位置。↑↑ 经上方，↓↓ 经下方。两个例子都是右手先换握，再转顶层。', 'Two matching arrows take one hand through a half turn into its grip. ↑↑ goes via the upper side and ↓↓ via the lower side. In both examples the right hand regrips before U.'],
  [['↑｜↓', '↑|↓'], '竖线分开两只手的起手，先右后左。两种竖线都可输入。这个例子是右手上起手、左手下起手。', 'A vertical bar gives both starting grips, right hand first. Both bar forms are accepted. Here the right hand takes an up grip and the left a down grip.'],
  ["U'p", '小写 p 紧跟完整转动表示推法。双手中起手时，U′ 用右食指推可写成此例。', 'Lowercase p immediately after a complete move calls for a push. With both hands in home grip, this example uses the right index to push U counterclockwise.'],
];

const positions: SymbolEntry[] = [
  [['C', 'Cc', 'Ce'], '大写 A 到 X 表示位置，小写字母指定块的种类。c 是角，e 是棱。省略种类时默认是角，所以 C 和 Cc 都是顶面的右前角贴纸，Ce 是顶面的前棱贴纸。', 'Capital A through X gives a position. A lowercase suffix selects the piece type. The default c means corner and e means edge. C and Cc name the top sticker of the front-right corner, while Ce names the top sticker of the front edge.'],
  [['Qw', 'Qm'], 'w 是翼棱，m 是奇数阶的中棱。Qw 指 Q 对应的翼棱贴纸，Qm 指同一字母对应的中棱贴纸。', 'w selects a wing, and m selects the middle edge on an odd-order cube. Qw and Qm use the same letter on those two different piece types.'],
  [['Qx', 'Qt', 'Qo'], 'x 是沿面对角线分布的 X 心，t 是沿面中心十字线分布的十字心，o 是偏离这两条线的斜心。Qx、Qt、Qo 分别在这三类中心块中查 Q。', 'x selects an X-center on a face diagonal. t selects a plus-center on the horizontal or vertical centerline. o selects an oblique center off both lines. Qx, Qt and Qo locate Q among those respective centers.'],
  ['Qw2', '五阶及以上若同类块还要区分轨道，可在种类后写环号。Qw2 指编号为 2 的翼棱轨道上的 Q。', 'On cubes of order five and above, a digit after the piece type can distinguish rings. Qw2 selects Q on the wing ring numbered 2.'],
];

const timing: SymbolEntry[] = [
  [['(0-.5)', '(.5-1)'], '圆括号写在冒号后面。连字符两边是这根手指开始和结束动作时的转动进度。0 是开始，.5 是一半，1 是结束。省略圆括号时默认为整步。', 'Parentheses after the colon set the active interval. The hyphen separates start and end progress. 0 is the start, .5 is halfway and 1 is the end. Omitting the interval gives the finger the whole turn.'],
  ['U2[R2:(0-.5)Q>M;R3:(.5-1)Q>M]', '分号把同一次转动里的两条指令分开。右食指拨前 90°，右中指接后 90°。两指各从自己的起拨位置出发。', 'A semicolon separates instructions within one turn. The right index takes the first 90° and the right middle takes the second 90°. Each starts its stroke at Q.'],
  ['U[R2:Q>M;L2:~B^1.5]', '两条指令的时间范围也可以重叠。这里右食指从 Q 拨向 M，同时左食指向背面外侧抬起，为转层让出空间。', 'Intervals may overlap. Here the right index sweeps from Q to M while the left index lifts away from the back face to clear the layer.'],
];

const techniques: SymbolEntry[] = [
  ['Q>M.f', '.f 表示拨。指尖沿给定路径拨动转层。', '.f means flick. The fingertip drives the layer along the given path.'],
  ['@Me>Qe.p', '.p 表示推。手指推住棱贴纸，从 Me 随转层一起到 Qe。', '.p means push. The finger pushes the edge sticker from Me to Qe while staying on it.'],
  ['@C>K.t', '.t 表示越顶。手指贴着 C，随前层转过顶面边缘到 K。', '.t means over the top. The fingertip follows C over the top edge to K as the front layer turns.'],
  ['@C>Q.w', '.w 表示手随转层一起转。@ 描述指尖贴住的位置，.w 描述整只手如何带动这一转。', '.w moves the hand with the turning layer. The @ describes the fingertip contact and .w describes how the hand drives the turn.'],
];

function SymbolList({ entries }: { entries: SymbolEntry[] }) {
  const t = useT();
  return <dl>{entries.map(([example, zh, en]) => <Fragment key={typeof example === 'string' ? example : example[0]}>
    <dt>{(typeof example === 'string' ? [example] : example).map(token => <code key={token}>{token}</code>)}</dt><dd>{t(zh, en)}</dd>
  </Fragment>)}</dl>;
}

function CornerStickerNet({ label }: { label: string }) {
  const { width, height, faces } = unfoldedGrid(3);
  return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} textAnchor="middle">
    {CUBE_FACE_LETTERS.map((face, index) => {
      const [x, y] = faces[index];
      return <g key={face} transform={`translate(${x} ${y})`}>
        {Array.from({ length: 9 }, (_, cell) => {
          const row = Math.floor(cell / 3), col = cell % 3;
          const corner = row !== 1 && col !== 1;
          const letter = corner ? stickerLetter(face, 3, row, col) : null;
          const marked = letter === 'C' || letter === 'Q';
          return <g key={cell} transform={`translate(${col} ${row})`}>
            <rect width="1" height="1" fill={CUBE_FILL[face]} stroke={CUBE_ON_FILL.U} strokeWidth=".04" />
            {marked && <circle cx=".5" cy=".5" r=".37" fill="none" stroke={CUBE_ON_FILL[face]} strokeWidth=".06" />}
            {(letter || cell === 4) && <text x=".5" y=".51" dominantBaseline="central"
              fill={CUBE_ON_FILL[face]} fontSize={corner ? '.48' : '.32'} fontWeight={marked ? 750 : 550}>
              {letter ?? face}
            </text>}
          </g>;
        })}
      </g>;
    })}
  </svg>;
}

export default function FingerAnnotationsPage() {
  const t = useT();
  return <main className="ftn-guide">
    <PageHeading backHref="/sim">{t('进阶指法注解', 'Advanced Finger Annotations')}</PageHeading>
    <p>{t('先读方括号前的转动，再读括号里哪根手指、贴在哪里、怎样随转层移动。', 'Read the move before the brackets first. Inside the brackets, look for the finger, its point of contact and the path it follows during the turn.')}</p>
    <section>
      <h2>{t('读懂一个可播放的例子', 'Read a playable example')}</h2>
      <FingerAnnotationExample />
      <AppLink className="ftn-demo-link" href={pinExampleHref}>{t('在模拟器中打开示例', 'Open example in simulator')}<ArrowUpRight size={16} aria-hidden /></AppLink>
    </section>
    <section>
      <h2>{t('在展开图上找 C 和 Q', 'Find C and Q on the cube net')}</h2>
      <figure><CornerStickerNet label={t('三阶 Speffz 角贴纸位置图，顶面右下角是 C，背面左上角是 Q', '3×3 Speffz corner stickers. C is at the lower right of U and Q at the upper left of B.')} />
        <figcaption>{t('中心字母标面名，角上的字母标贴纸位置。做一次 R，指尖贴着同一张贴纸，从顶面右下角的 C（起点）转到背面左上角的 Q（终点）。', 'Center letters name the faces. Corner letters label sticker positions. During R, the fingertip follows one sticker from C at the lower right of U to Q at the upper left of B.')}</figcaption>
      </figure>
    </section>
    <section>
      <h2>{t('方括号外的转动与起手', 'Move and grip marks outside the brackets')}</h2>
      <SymbolList entries={moveMarks} />
    </section>
    <section>
      <h2>{t('完整记法与示例', 'Full notation with examples')}</h2>
      <p>{t('目前模拟器能按方括号播放的指法是上面的右食指贴块示例及其简写。以下用例用于读谱，展示完整记法能表达的动作。', 'The simulator currently plays the right-index pin shown above, including its abbreviated form. The examples below illustrate how to read the rest of the notation.')}</p>
      <h3>{t('用哪只手、哪根手指', 'Hand and finger')}</h3><SymbolList entries={fingers} />
      <h3>{t('接触、移动与避让', 'Contact, movement and clearance')}</h3><SymbolList entries={contact} />
      <h3>{t('贴纸字母与高阶位置', 'Sticker letters and larger cubes')}</h3><SymbolList entries={positions} />
      <h3>{t('分段发力与双指配合', 'Timing and two-finger coordination')}</h3><SymbolList entries={timing} />
      <h3>{t('动作末尾的技法后缀', 'Technique suffixes')}</h3>
      <p>{t('后缀写在一条手指指令的末尾。省略时，按转动和握姿选择默认手法。', 'Place a suffix at the end of a finger instruction. Omit it to use the default technique for the move and grip.')}</p>
      <SymbolList entries={techniques} />
    </section>
  </main>;
}
