'use client';

// 盲拧训练说明 (3BLD Guide) — bilingual static intro / doc page.
// Faithful port of spooncuber readme.html: the 10 module descriptions + the
// public-beta note + author credit + performance note + acknowledgements.
// Personal contact numbers (QQ 群/作者 QQ) and external mirror domains from the
// upstream are intentionally omitted — this page is about the tool only.

import type { JSX } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import {
  Info,
  ScanLine,
  Square,
  Boxes,
  RotateCw,
  RotateCcw,
  Move,
  Repeat2,
  GitCompareArrows,
  SplitSquareVertical,
  Gauge,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../3bld.css';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

interface ModuleDoc {
  n: number;
  href: string | null;
  icon: JSX.Element;
  titleZh: string;
  titleEn: string;
  bodyZh: JSX.Element;
  bodyEn: JSX.Element;
    titleZhHant?: string;
    bodyZhHant?: JSX.Element;
}

export default function BldGuidePage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('盲拧训练说明', '3BLD Guide', "盲擰訓練說明");

  const modules: ModuleDoc[] = [
    {
      n: 1,
      href: '/trainer/3bld/helper',
      icon: <ScanLine size={16} />,
      titleZh: '读码还原助手',
      titleEn: 'Read & Restore Helper',
      bodyZh: (
        <>
          <p>
            两项核心功能:输入打乱,输出盲拧编码;输入盲拧编码,输出魔方状态(带 3D 魔方显示)。
          </p>
          <p>
            主要为了解决初学者编码容易编错的问题,提供一个通用性更好的读码工具。还原功能相当于一位「不会做错公式的老师」:可以尝试不同的编码方法,如果 3D 魔方最终被还原,说明编码正确;编码不熟时可借此确认是否有问题。复盘或遇到卡点时,也可以每做一条公式就同步输入还原编码,核对 3D 魔方状态是否一致,从而快速定位问题。
          </p>
          <p>
            默认缓冲为棱 A(UF)、角 J(UFR)。修改缓冲块时需要相应调整借位位置,借位位置不能与缓冲位置重复。保持色相的借位法按所学教程选择即可(固定借位 / 跳编法),初学者可不选。
          </p>
        </>
      ),
      bodyEn: (
        <>
          <p>
            Two core functions: feed a scramble, get the blind code; feed a blind code, get the cube state (with a 3D cube view).
          </p>
          <p>
            Built mainly to fix the beginner pain of mis-coding, and to be a more universal read tool than the apps. The restore function acts like a teacher who never executes an alg wrong: try out different lettering schemes — if the 3D cube ends up solved, your code was correct. When your lettering is still shaky, this confirms whether the code holds up. During review or when stuck, you can also type the restore code one alg at a time and check that the 3D cube state matches, to pinpoint a problem fast.
          </p>
          <p>
            Default buffers are edge A (UF) and corner J (UFR). When you change buffers, adjust the borrow/setup position accordingly — it must not coincide with the buffer position. Pick the color-preserving borrow method to match your tutorial (fixed-borrow / jump-coding); beginners can leave it off.
          </p>
        </>
      ),
        titleZhHant: "讀碼還原助手"
    },
    {
      n: 2,
      href: '/trainer/3bld/edge',
      icon: <Square size={16} />,
      titleZh: '棱块公式训练',
      titleEn: 'Edge Algorithm Trainer',
      bodyZh: (
        <>
          <p>
            输入想练习的公式,输出贴近实战的打乱,并尽快遍历所有输入公式。两种模式:
          </p>
          <ul>
            <li>
              <b>精准生成模式:</b>从输入公式中优先选取出现次数较少的,构造状态并求解出打乱(生成的打乱没有小循环)。当所有输入公式都至少出现一次,即停止生成并输出打乱与信息。
            </li>
            <li>
              <b>随机生成模式:</b>随机生成打乱并读码,从中挑选包含较多目标公式的。每次点击随机生成 1 万条,最终输出命中训练公式数量排名靠前的 100 条。
            </li>
          </ul>
        </>
      ),
      bodyEn: (
        <>
          <p>
            Enter the algs you want to drill; it outputs realistic scrambles and traverses every input alg as fast as possible. Two modes:
          </p>
          <ul>
            <li>
              <b>Precise mode:</b> picks the least-seen algs first, builds the corresponding state, and solves a scramble for it (scrambles contain no small cycles). Once every input alg has appeared at least once, it stops and outputs the scrambles plus stats.
            </li>
            <li>
              <b>Random mode:</b> generates random scrambles, reads their codes, and keeps the ones covering the most target algs. Each click generates 10,000 scrambles and outputs the top 100 by number of training algs hit.
            </li>
          </ul>
        </>
      ),
        titleZhHant: "稜塊公式訓練"
    },
    {
      n: 3,
      href: '/trainer/3bld/corner',
      icon: <Boxes size={16} />,
      titleZh: '角块公式训练',
      titleEn: 'Corner Algorithm Trainer',
      bodyZh: <p>功能与棱块公式训练相同,针对角块公式。</p>,
      bodyEn: <p>Same as the edge algorithm trainer, for corner algs.</p>,
        titleZhHant: "角塊公式訓練"
    },
    {
      n: 4,
      href: '/trainer/3bld/twist',
      icon: <RotateCw size={16} />,
      titleZh: '翻角公式训练',
      titleEn: 'Corner Twist Trainer',
      bodyZh: (
        <>
          <p>无奇偶。角块会出现缓冲块之外的两个翻角。</p>
          <p>可选择「缓冲外二角翻」与「带缓冲三角翻」,并可自定义两个翻角的出现位置组合。</p>
        </>
      ),
      bodyEn: (
        <>
          <p>No parity. Two twisted corners appear, excluding the buffer.</p>
          <p>
            You can choose between a two-corner twist (excluding the buffer) and a three-corner twist (including the buffer), and customize which two positions the twists land on.
          </p>
        </>
      ),
        titleZhHant: "翻角公式訓練"
    },
    {
      n: 5,
      href: '/trainer/3bld/flip',
      icon: <RotateCcw size={16} />,
      titleZh: '翻棱公式训练',
      titleEn: 'Edge Flip Trainer',
      bodyZh: <p>功能与翻角公式训练相同,针对翻棱。</p>,
      bodyEn: <p>Same as the corner twist trainer, for flipped edges.</p>,
        titleZhHant: "翻稜公式訓練"
    },
    {
      n: 6,
      href: '/trainer/3bld/edge-float',
      icon: <Move size={16} />,
      titleZh: '棱块浮动训练',
      titleEn: 'Edge Float Trainer',
      bodyZh: (
        <>
          <p>
            <b>【浮动顺序】</b>目前支持输入两个字母,第一位为主缓冲编码,第二位为副缓冲编码。脚本从副缓冲公式中优先选取出现次数较少的,直到所有副缓冲公式都至少出现一次,才停止生成并输出打乱与信息。
          </p>
          <p>
            <b>【排除位置】</b>为不会被打乱的棱块位置。例如已掌握 4 个缓冲、顺序为 AEGC,现在想练第三、第四缓冲:在【排除位置】填 AE,在【浮动顺序】填 GC 即可。
          </p>
          <p>
            如果【浮动顺序】留空,生成的打乱会将【排除位置】上的棱块复原,其余位置完全随机,且不控制公式出现次数(排除模式)。
          </p>
        </>
      ),
      bodyEn: (
        <>
          <p>
            <b>Float order:</b> currently takes two letters — the first is the main buffer code, the second the sub buffer code. The script picks the least-seen sub-buffer algs first and keeps going until every sub-buffer alg has appeared at least once, then stops and outputs the scrambles plus stats.
          </p>
          <p>
            <b>Eject positions:</b> the edge positions that will <i>not</i> be scrambled. Example: you already know 4 buffers in the order AEGC and now want to drill the 3rd and 4th buffer — put AE in Eject positions and GC in Float order.
          </p>
          <p>
            If Float order is left empty, scrambles solve the pieces at the Eject positions and randomize everything else fully, without controlling how often any alg appears (eject mode).
          </p>
        </>
      ),
        titleZhHant: "稜塊浮動訓練"
    },
    {
      n: 7,
      href: '/trainer/3bld/corner-float',
      icon: <Move size={16} />,
      titleZh: '角块浮动训练',
      titleEn: 'Corner Float Trainer',
      bodyZh: <p>功能与棱块浮动训练相同,针对角块。</p>,
      bodyEn: <p>Same as the edge float trainer, for corners.</p>,
        titleZhHant: "角塊浮動訓練"
    },
    {
      n: 8,
      href: '/trainer/3bld/2c2c',
      icon: <GitCompareArrows size={16} />,
      titleZh: '2C2C 训练',
      titleEn: '2C2C Trainer',
      bodyZh: (
        <>
          <p>
            2C2C 指四个角块二二互换的情况。脚本会从输入编码生成「缓冲与输入编码交换,另外任意两块互换」的全部情况。
          </p>
          <p>
            不勾选「是否带翻」时,每个编码生成不带色向的 <b>45</b> 条公式(如角 JG 互换、RX 互换);勾选「是否带翻」时,每个编码生成全部 <b>135</b> 条公式。
          </p>
          <p>勾选「是否排除顶层」可保证互换的两个角块出现在底层。</p>
        </>
      ),
      bodyEn: (
        <>
          <p>
            2C2C is the case of four corners swapping in two pairs. The script generates, from each input code, every case of &ldquo;buffer swaps with the input code, plus any other two pieces swap.&rdquo;
          </p>
          <p>
            With &ldquo;include twist&rdquo; off, each code produces the <b>45</b> orientation-free algs (e.g. corners JG swap, RX swap); with &ldquo;include twist&rdquo; on, each code produces the full <b>135</b> algs.
          </p>
          <p>Checking &ldquo;exclude top layer&rdquo; forces both swapped corners to land on the bottom layer.</p>
        </>
      ),
        titleZhHant: "2C2C 訓練"
    },
    {
      n: 9,
      href: '/trainer/3bld/ltct',
      icon: <Repeat2 size={16} />,
      titleZh: '奇偶带翻训练',
      titleEn: 'Parity-Twist (LTCT) Trainer',
      bodyZh: (
        <>
          <p>
            输入奇偶带翻编码(第一位为奇偶码,第二位为翻色码),生成相同数量的随机打乱,所有输入的奇偶带翻情况均会出现 1 次。
          </p>
          <p>
            「打乱棱块」控制棱块是否被打乱,不勾选则棱块状态为 UF-UR 互换;「打乱其他角块」控制角块状态,不勾选则角块直接处于可使用奇偶带翻的状态。
          </p>
        </>
      ),
      bodyEn: (
        <>
          <p>
            Enter parity-twist codes (first digit = parity code, second = twist code); it generates the same number of random scrambles, with every input parity-twist case appearing exactly once.
          </p>
          <p>
            &ldquo;Scramble edges&rdquo; controls whether edges get scrambled — off leaves edges in a UF-UR swap. &ldquo;Scramble other corners&rdquo; controls corner state — off puts corners directly into a usable parity-twist state.
          </p>
        </>
      ),
        titleZhHant: "奇偶帶翻訓練"
    },
    {
      n: 10,
      href: '/trainer/3bld/parity',
      icon: <SplitSquareVertical size={16} />,
      titleZh: '奇偶训练',
      titleEn: 'Parity Trainer',
      bodyZh: (
        <>
          <p>
            输入奇偶编码(第一位为棱块,第二位为角块),生成相同数量的随机打乱,所有输入的奇偶情况均会出现 1 次。
          </p>
          <p>
            「打乱其他棱块」控制棱块状态,不勾选则为缓冲和输入码互换;「打乱其他角块」控制角块状态,不勾选则为缓冲和输入码互换。
          </p>
        </>
      ),
      bodyEn: (
        <>
          <p>
            Enter parity codes (first digit = edge, second = corner); it generates the same number of random scrambles, with every input parity case appearing exactly once.
          </p>
          <p>
            &ldquo;Scramble other edges&rdquo; controls edge state — off leaves a buffer-and-input-code swap. &ldquo;Scramble other corners&rdquo; controls corner state — off leaves a buffer-and-input-code swap.
          </p>
        </>
      ),
        titleZhHant: "奇偶訓練"
    },
  ];

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{tr({ zh: '盲拧训练说明', en: '3BLD Guide',
            zhHant: "盲擰訓練說明"
        })}</h1>
      </div>

      {/* ── intro / public-beta note ── */}
      <p className="bld-input-summary" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Info size={16} style={{ flex: '0 0 auto', marginTop: 2 }} />
        <span>
          {tr({ zh: '盲拧训练器的目标是生成贴近实战的打乱,并尽快遍历指定的训练内容,从而更高效地针对特定情况练习。目前主要功能为棱块 / 角块公式训练、读码还原助手,其余页面持续优化新增中。', en: 'The 3BLD trainer aims to produce realistic scrambles and traverse a chosen set of cases as fast as possible, so you can drill specific situations more efficiently. The main features today are edge / corner algorithm training and the read & restore helper; other pages are being added and refined.',
              zhHant: "盲擰訓練器的目標是生成貼近實戰的打亂,並儘快遍歷指定的訓練內容,從而更高效地針對特定情況練習。目前主要功能為稜塊 / 角塊公式訓練、讀碼還原助手,其餘頁面持續最佳化新增中。"
        })}
        </span>
      </p>

      <ul className="bld-guide-notes">
        <li>
          {tr({ zh: '所有页面的打乱坐标均为还原坐标。', en: 'On every page, scramble coordinates are given in the solved-state frame.',
              zhHant: "所有頁面的打亂座標均為還原座標。"
        })}
        </li>
        <li>
          {tr({ zh: '编码采用彳亍编码(后续会支持自定义编码)。', en: 'Lettering uses the Chìchù scheme (custom schemes are planned).',
              zhHant: "編碼採用彳亍編碼(後續會支援自定義編碼)。"
        })}
        </li>
        <li>
          {tr({ zh: '暂不写入 cookie,输入的内容请自行保存。', en: 'No cookies are set yet — save your inputs yourself.',
              zhHant: "暫不寫入 cookie,輸入的內容請自行儲存。"
        })}
        </li>
        <li>
          {tr({ zh: '目前为公测第一版,功能与文案仍在调整中。', en: 'This is the first public-beta release; features and wording are still evolving.',
              zhHant: "目前為公測第一版,功能與文案仍在調整中。"
        })}
        </li>
      </ul>

      {/* ── per-module sections ── */}
      {modules.map((m) => (
        <section key={m.n} className="bld-guide-section">
          <h2 className="bld-guide-heading">
            <span className="bld-guide-num">{m.n}</span>
            <span className="bld-guide-icon">{m.icon}</span>
            {m.href ? (
              <Link href={m.href} className="bld-guide-title-link">
                {i18n.language === 'zh-Hant' ? (m.titleZhHant ?? m.titleZh) : (isZh ? m.titleZh : m.titleEn)}
              </Link>
            ) : (
              <span>{i18n.language === 'zh-Hant' ? (m.titleZhHant ?? m.titleZh) : (isZh ? m.titleZh : m.titleEn)}</span>
            )}
          </h2>
          <div className="bld-guide-body">{i18n.language === 'zh-Hant' ? (m.bodyZhHant ?? m.bodyZh) : (isZh ? m.bodyZh : m.bodyEn)}</div>
        </section>
      ))}

      {/* ── performance note ── */}
      <section className="bld-guide-section">
        <h2 className="bld-guide-heading">
          <span className="bld-guide-icon">
            <Gauge size={16} />
          </span>
          <span>{tr({ zh: '计算性能', en: 'Performance',
              zhHant: "計算效能"
        })}</span>
        </h2>
        <div className="bld-guide-body">
          <p>
            {tr({ zh: '所有计算都在你的设备本地完成,速度因此取决于设备性能。在一台桌面级 CPU 上各项操作基本可在 2 秒内完成(目前最慢的是带奇偶的棱块浮动生成)。如遇页面异常卡顿,可向作者反馈。', en: 'All computation runs locally on your device, so speed depends on your hardware. On a desktop-class CPU each operation finishes within about 2 seconds (the slowest today is float-edge generation with parity). If a page hangs abnormally, let the author know.',
                zhHant: "所有計算都在你的裝置本地完成,速度因此取決於裝置效能。在一臺桌面級 CPU 上各項操作基本可在 2 秒內完成(目前最慢的是帶奇偶的稜塊浮動生成)。如遇頁面異常卡頓,可向作者反饋。"
            })}
          </p>
        </div>
      </section>

      {/* ── credits / acknowledgements ── */}
      <section className="bld-guide-section bld-guide-credits">
        <h2 className="bld-guide-heading">
          <span>{tr({ zh: '致谢', en: 'Acknowledgements',
              zhHant: "致謝"
        })}</span>
        </h2>
        <div className="bld-guide-body">
          <p>
            {i18n.language === 'zh-Hant' ? ((
                                    <>
                                      盲擰訓練器由 <b>勺子(喬智 / Zhi Qiao)</b> 開發,以 GPL-3.0 協議開源。本站為移植整合版本,引擎與玩法忠實於原作。
                                    </>
                                  )) : (isZh ? (
                                    <>
                                      盲拧训练器由 <b>勺子(乔智 / Zhi Qiao)</b> 开发,以 GPL-3.0 协议开源。本站为移植整合版本,引擎与玩法忠实于原作。
                                    </>
                                  ) : (
                                    <>
                                      The 3BLD trainer was created by <b>Spoon (Zhi Qiao)</b> and open-sourced under GPL-3.0. This site is a ported / integrated build that stays faithful to the original engine and behaviour.
                                    </>
                                  ))}
          </p>
        </div>
      </section>
    </div>
  );
}
