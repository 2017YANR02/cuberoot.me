'use client';

/**
 * SQ1 WCA 12c4 metric God's number = an unsolved mystery.
 *
 * Square-1 has three move metrics. Two are exhaustively proven; the third — the
 * WCA 12c4 metric (the scramble-length metric a timer / cstimer reports) — has
 * never been exhaustively computed. That open problem is what this component tells.
 *   - twist / slash : count only "/"; layer turns free   -> God's number 13 (Masonjones 2005)
 *   - face-turn     : (x,0)/(0,y)/"/" = 1, double (x,y)=2 -> God's number 31 (Chen 2017, 722 GB disk BFS)
 *   - WCA 12c4      : (X,Y) = 1, "/" = 1                  -> God's number UNKNOWN; true value strictly between 13 and 31
 *
 * Two live controls: a storage estimator (two sliders) + an interactive number-line SVG.
 */
import { useMemo, useState } from 'react';
import { STATE_SPACE, TWOGEN } from './sq1_data';

interface Props {
  isZh: boolean;
}

// Search space of the 12c4 BFS (twistable positions); same source as STATE_SPACE.twistable.
const TWISTABLE = 11_958_666_854_400;

// Disk Chen actually used for the face-turn exhaustive BFS.
const CHEN_FACE_GB = 722;

type MarkerKey = 'twist' | 'open' | 'face';

interface Marker {
  key: MarkerKey;
  move: number;
  color: string;
}

export default function OpenProblemBracket({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [bits, setBits] = useState(2); // bits / position, 1..8
  const [sym, setSym] = useState(4); // symmetry-reduction factor, 1..16
  const [active, setActive] = useState<MarkerKey>('open');

  // disk = positions x bits / 8 / symmetry (bytes)
  const storage = useMemo(() => {
    const bytes = (TWISTABLE * bits) / 8 / sym;
    return {
      gb: bytes / 1e9, // 1 GB = 1e9 bytes
      tb: bytes / 1e12, // 1 TB = 1e12 bytes
    };
  }, [bits, sym]);

  const gbText = storage.gb.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const tbText = storage.tb.toLocaleString('en-US', { maximumFractionDigits: 2 });

  const readout: Record<MarkerKey, { title: string; body: string }> = {
    twist: {
      title: t('13 步 扭转口径 已证', '13 moves, Twist metric, proven'),
      body: t(
        '只数 "/" 切片,顶底层转免费。Masonjones 在 2005 年穷举整个状态空间得出上帝之数为 13。这是最宽松的口径,所以数字最小。',
        'Counts only "/" slices; layer turns are free. Masonjones exhaustively searched the whole state space in 2005 and proved God’s number is 13. This is the loosest metric, so the number is smallest.',
      ),
    },
    open: {
      title: t('? 步 WCA 12c4 口径 未知', '? moves, WCA 12c4 metric, unknown'),
      body: t(
        '(X,Y) 算 1,"/" 算 1 —— 这正是计时器 / cstimer 报的打乱长度口径。双层 (x,y) 比面转便宜(1 而非 2),但层转又不像扭转口径那样免费,所以真值严格落在 13 与 31 之间;具体是多少,至今从未被穷举算出。',
        '(X,Y) costs 1 and "/" costs 1 — the very metric a timer / cstimer reports as scramble length. A combined (x,y) is cheaper than in the face-turn metric (1 instead of 2), yet layer turns are not free as in the twist metric, so the true value sits strictly between 13 and 31. Exactly where, nobody has ever exhaustively computed.',
      ),
    },
    face: {
      title: t('31 步 面转口径 已证', '31 moves, Face-turn metric, proven'),
      body: t(
        '(x,0)/(0,y)/"/" 各算 1,双层 (x,y) 算 2。Shuang Chen 在 2017 年用一次 722GB 磁盘的 BFS 穷举证明上帝之数为 31。这是最严格的口径,所以数字最大。',
        '(x,0)/(0,y)/"/" each cost 1; a combined (x,y) costs 2. Shuang Chen proved God’s number is 31 in 2017 via a single 722 GB disk-based BFS. This is the strictest metric, so the number is largest.',
      ),
    },
  };

  // Number-line SVG geometry. viewBox 0 0 640 150 -> maxWidth 640 (mandatory).
  const VB_W = 640;
  const VB_H = 150;
  const AXIS_Y = 96;
  const PAD_L = 30;
  const PAD_R = 30;
  const MIN_MOVE = 10;
  const MAX_MOVE = 33;

  const sx = (move: number) =>
    PAD_L + ((move - MIN_MOVE) / (MAX_MOVE - MIN_MOVE)) * (VB_W - PAD_L - PAD_R);

  const ticks: number[] = [];
  for (let m = MIN_MOVE; m <= MAX_MOVE; m++) ticks.push(m);

  const markers: Marker[] = [
    { key: 'twist', move: 13, color: 'var(--sq1-proven)' },
    { key: 'face', move: 31, color: 'var(--sq1-info)' },
  ];

  const bandX1 = sx(13);
  const bandX2 = sx(31);
  const bandMid = (bandX1 + bandX2) / 2;

  return (
    <div className="sq1-panel">
      <div className="sq1-panel-title">
        {t('一道仍然敞开的未解之谜', 'A mystery that is still wide open')}
      </div>
      <div className="sq1-panel-sub">
        {t(
          'Square-1 的三套计步口径里,扭转(13)和面转(31)都已被穷举证明,唯独 WCA 12c4 口径的上帝之数至今没人算出来。',
          'Of Square-1’s three move metrics, twist (13) and face-turn (31) are both exhaustively proven — but the God’s number of the WCA 12c4 metric has never been computed.',
        )}
      </div>

      {/* Interactive number line */}
      <svg
        className="sq1-svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ maxWidth: VB_W }}
        role="img"
        aria-label={t(
          '步数数轴:13 已证(扭转)、31 已证(面转)、其间为 WCA 12c4 未知区',
          'Move-count number line: 13 proven (twist), 31 proven (face-turn), unknown WCA 12c4 region in between',
        )}
      >
        {/* unknown region: amber band */}
        <rect
          x={bandX1}
          y={AXIS_Y - 30}
          width={bandX2 - bandX1}
          height={60}
          rx={6}
          fill="var(--sq1-open-soft)"
          stroke="var(--sq1-open)"
          strokeWidth={active === 'open' ? 2 : 1}
          strokeDasharray="5 4"
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setActive('open')}
          onClick={() => setActive('open')}
        />
        <text
          x={bandMid}
          y={AXIS_Y + 6}
          textAnchor="middle"
          fontSize={30}
          fontWeight={700}
          fill="var(--sq1-open)"
          style={{ pointerEvents: 'none' }}
        >
          ?
        </text>
        <text
          x={bandMid}
          y={AXIS_Y - 18}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="var(--sq1-open)"
          style={{ pointerEvents: 'none' }}
        >
          {t('WCA 12c4 未知', 'WCA 12c4 unknown')}
        </text>

        {/* main axis */}
        <line
          x1={PAD_L}
          y1={AXIS_Y}
          x2={VB_W - PAD_R}
          y2={AXIS_Y}
          stroke="var(--sq1-grid)"
          strokeWidth={2}
        />

        {/* ticks + numbers */}
        {ticks.map((m) => {
          const big = m === 13 || m === 31;
          return (
            <g key={m}>
              <line
                x1={sx(m)}
                y1={AXIS_Y - (big ? 7 : 4)}
                x2={sx(m)}
                y2={AXIS_Y + (big ? 7 : 4)}
                stroke="var(--sq1-grid)"
                strokeWidth={big ? 1.5 : 1}
              />
              {(m % 2 === 0 || big) && (
                <text
                  x={sx(m)}
                  y={AXIS_Y + 22}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--sq1-text-mute)"
                >
                  {m}
                </text>
              )}
            </g>
          );
        })}

        {/* proven markers: green 13 / blue 31 */}
        {markers.map((mk) => {
          const on = active === mk.key;
          const label =
            mk.key === 'twist'
              ? t('扭转 已证', 'Twist, proven')
              : t('面转 已证', 'Face-turn, proven');
          return (
            <g
              key={mk.key}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setActive(mk.key)}
              onClick={() => setActive(mk.key)}
            >
              <line
                x1={sx(mk.move)}
                y1={AXIS_Y - 30}
                x2={sx(mk.move)}
                y2={AXIS_Y}
                stroke={mk.color}
                strokeWidth={on ? 3 : 2}
              />
              <circle
                cx={sx(mk.move)}
                cy={AXIS_Y - 30}
                r={on ? 8 : 6}
                fill={mk.color}
                stroke="var(--sq1-surface-2)"
                strokeWidth={1.5}
              />
              <text
                x={sx(mk.move)}
                y={AXIS_Y - 42}
                textAnchor="middle"
                fontSize={13}
                fontWeight={700}
                fill={mk.color}
                style={{ pointerEvents: 'none' }}
              >
                {mk.move}
              </text>
              <text
                x={sx(mk.move)}
                y={AXIS_Y + 38}
                textAnchor="middle"
                fontSize={9}
                fill="var(--sq1-text-sub)"
                style={{ pointerEvents: 'none' }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* number-line readout */}
      <div className="sq1-readout">
        <strong style={{ color: 'var(--sq1-text)' }}>{readout[active].title}</strong>
        <br />
        {readout[active].body}
      </div>

      <p className="sq1-caption">
        {t(
          '在数轴上悬停或点击 13、31 或中间的 “?” 看说明。提示:双层动作在 12c4 里比面转便宜,但层转又不免费,所以真值被夹在两个已证数之间。',
          'Hover or click 13, 31, or the “?” on the line for details. The combined-layer move is cheaper in 12c4 than in face-turn, yet layer turns are not free — so the true value is sandwiched between the two proven numbers.',
        )}
      </p>

      {/* storage estimator */}
      <div className="sq1-panel-title" style={{ marginTop: '1.4rem' }}>
        {t('要算出来得多少磁盘?', 'How much disk would it take to compute?')}
      </div>
      <div className="sq1-panel-sub">
        {t(
          '把 Chen 的面转机器换上 12c4 的代价模型重跑一遍即可:同样的 11,958,666,854,400 个可切位置、镜像 + 旋转对称约简、每位置约 2 bit 的磁盘 BFS。拖动滑块估算所需磁盘。',
          'Retarget Chen’s face-turn machinery with the 12c4 cost model: the same 11,958,666,854,400 twistable positions, mirror + rotation symmetry reduction, and a disk-based BFS at roughly 2 bits per position. Drag the sliders to estimate the disk needed.',
        )}
      </div>

      <div className="sq1-result-row">
        <span className="sq1-result-label">{t('每位置比特数', 'Bits per position')}</span>
        <span className="sq1-result-val">{bits}</span>
      </div>
      <input
        className="sq1-range"
        type="range"
        min={1}
        max={8}
        step={1}
        value={bits}
        onChange={(e) => setBits(Number(e.target.value))}
        aria-label={t('每位置比特数', 'Bits per position')}
      />

      <div className="sq1-result-row" style={{ marginTop: 10 }}>
        <span className="sq1-result-label">{t('对称约简因子', 'Symmetry-reduction factor')}</span>
        <span className="sq1-result-val">×{sym}</span>
      </div>
      <input
        className="sq1-range"
        type="range"
        min={1}
        max={16}
        step={1}
        value={sym}
        onChange={(e) => setSym(Number(e.target.value))}
        aria-label={t('对称约简因子', 'Symmetry-reduction factor')}
      />

      <div className="sq1-readout">
        <div className="sq1-result-row">
          <span className="sq1-result-label">{t('所需磁盘', 'Disk required')}</span>
          <span className="sq1-result-val" style={{ color: 'var(--sq1-open)' }}>
            ~{gbText} GB
          </span>
        </div>
        <div className="sq1-result-row">
          <span className="sq1-result-label">{t('换算成 TB', 'In terabytes')}</span>
          <span className="sq1-result-val">~{tbText} TB</span>
        </div>
        <div className="sq1-result-row" style={{ borderBottom: 'none' }}>
          <span className="sq1-result-label">
            {t('Chen 面转实测用量', 'Chen’s actual face-turn run')}
          </span>
          <span className="sq1-result-val" style={{ color: 'var(--sq1-info)' }}>
            ~{CHEN_FACE_GB} GB
          </span>
        </div>
      </div>
      <p className="sq1-caption">
        {t(
          `公式:11,958,666,854,400 × ${bits} bit ÷ 8 ÷ ${sym}。默认 2 bit、约简 ×4 时约 747 GB,与 Chen 面转穷举的 ~722 GB 量级吻合 —— 工程量摆在那,只是还没人为 12c4 这个口径跑过。`,
          `Formula: 11,958,666,854,400 × ${bits} bits ÷ 8 ÷ ${sym}. At the defaults (2 bits, ×4 reduction) it lands near 747 GB — the same order as Chen’s ~722 GB face-turn run. The engineering is within reach; it just has never been run for the 12c4 metric.`,
        )}
      </p>

      {/* 43 / 44 caveat callout */}
      <div className="sq1-callout is-open">
        <strong>{t('别被 43 / 44 误导。', 'Do not be misled by 43 / 44.')}</strong>{' '}
        {t(
          `网上常见的 ${TWOGEN.diameter} / ${TWOGEN.diameterWithMiddle} 这两个数,是只用 "/" 和 (x,0) 两个生成元的 2-生成子群直径(查找表 ${TWOGEN.tableMB} MB / ${TWOGEN.tableWithMiddleMB} MB,含中层时为 ${TWOGEN.diameterWithMiddle}),并不是整个 Square-1 在任何标准口径下的上帝之数。WCA 12c4 用的是全部生成元,真值落在 13 与 31 之间;把 ${TWOGEN.diameter} / ${TWOGEN.diameterWithMiddle} 当成 12c4 上帝之数引用是错的。`,
          `The widely quoted ${TWOGEN.diameter} / ${TWOGEN.diameterWithMiddle} are the diameter of a 2-generator subgroup using only "/" and (x,0) (lookup tables of ${TWOGEN.tableMB} MB / ${TWOGEN.tableWithMiddleMB} MB; ${TWOGEN.diameterWithMiddle} when the middle layer is included). They are not the full-puzzle God’s number in any standard metric. The WCA 12c4 metric uses all generators and its true value lies between 13 and 31 — citing ${TWOGEN.diameter} / ${TWOGEN.diameterWithMiddle} as the 12c4 God’s number is simply wrong.`,
        )}
      </div>

      <p className="sq1-caption" style={{ color: 'var(--sq1-text-mute)' }}>
        {t(
          `状态空间(可切位置):${STATE_SPACE.twistable} 个。`,
          `State space (twistable positions): ${STATE_SPACE.twistable}.`,
        )}
      </p>
    </div>
  );
}
