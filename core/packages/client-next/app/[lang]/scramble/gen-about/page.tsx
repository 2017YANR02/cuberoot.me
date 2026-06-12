'use client';

/**
 * /scramble/gen-about — 打乱生成器说明页。介绍三种模式 (comp / batch / paste) +
 * 后台预生成 pool 的工作方式。从 GenPage 标题的 HelpCircle 入口进入。
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './gen_about.css';
import i18n from "@/i18n/i18n-client";
import { useT } from "@/hooks/useT";

interface StepProps {
  step: number;
  title: string;
  body: string;
  highlight?: boolean;
}
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`ga-step${highlight ? ' is-highlight' : ''}`}>
      <span className="ga-step-num">{step}</span>
      <div>
        <div className="ga-step-title">{title}</div>
        <div className="ga-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() {
  return <span className="ga-arrow" aria-hidden="true">↓</span>;
}

export default function GenAboutPage() {
  const { i18n } = useTranslation();
  const t = useT();
  useDocumentTitle('打乱生成器说明', 'Scramble Generator Guide', "打亂生成器說明");

  return (
    <div className="ga-page">
      <div className="ga-header">
        <Link href="/scramble/gen" className="ga-back">
          <ArrowLeft size={16} />
          <span>{t('返回打乱生成器', 'Back to scramble generator', "返回打亂生成器")}</span>
        </Link>
      </div>

      <main className="ga-main">
        <h1 className="ga-title">{t('打乱生成器是怎么工作的', 'How the scramble generator works', "打亂生成器是怎麼工作的")}</h1>
        <p className="ga-intro">
          {t(
            '/scramble/gen 是站内的统一打乱生成入口。3 种模式覆盖从「比赛官方打乱表」到「随手出 N 条练习」到「自带打乱粘进来出图」的常见需求。所有 WCA 项目走 Lucas Garron 的 cubing.js 随机状态生成器(3×3 可切到 min2phase-rust 引擎,cs0x7f Kociemba 的 Rust port,~10× 快;4×4 走 cs0x7f Threephase 走 Web Worker 池;5×5 可切到本站 cube555 daemon 真随机态)。除 WCA 21 项外另接入了三套非 WCA puzzle:cubing.js twizzleEvents 的 5 个(FTO / 四阶金字塔 / 二阶五魔 / Redi / 二阶 FTO);从 cs0x7f csTimer 引擎 vendor 进来的 31 个(齿轮/枫叶/恐龙/Sq2/SSq1/五魔金字塔/六阶五魔/直升机/cuboid 5 个/15-puzzle/8-puzzle 等);7 个 shape-mod 借用 WCA scramble(镜面/费舍尔/三阶金字塔/二阶金字塔/轴方/风火轮/幽灵/空心)。共 64 个 puzzle,非 WCA 默认折叠在「其他 ▾」chip 后,点开展示。',
            '/scramble/gen is the unified scramble entry point. Three modes cover the common needs: "official WCA scramble sheet", "quick N scrambles to practice", "paste my own scrambles for preview". All WCA events go through Lucas Garron\'s cubing.js random-state scramblers (3×3 can switch to the min2phase-rust engine — cs0x7f Kociemba ported to Rust, ~10× faster; 4×4 routes to cs0x7f Threephase via a Web Worker pool; 5×5 can switch to our server-side cube555 daemon for true random-state). Beyond WCA 21 we plug in three more sources: 5 random-state events from cubing.js twizzleEvents (FTO / Master Tetra / Kilominx / Redi / Baby FTO); 31 events vendored from cs0x7f csTimer (Gear / Ivy / Dino / Sq2 / SSq1 / Pyraminx Crystal / Gigaminx / Helicopter / 5 cuboids / 15-puzzle / 8-puzzle / …); 7 shape mods borrowing WCA scrambles (Mirror Blocks / Fisher / Mastermorphix / Pyramorphix / Axis / Windmill / Ghost / Void). 64 puzzles total; non-WCA ones collapse behind an "Other ▾" chip by default.', "/scramble/gen 是站內的統一打亂生成入口。3 種模式覆蓋從「比賽官方打亂表」到「隨手出 N 條練習」到「自帶打亂粘進來出圖」的常見需求。所有 WCA 項目走 Lucas Garron 的 cubing.js 隨機狀態生成器(3×3 可切到 min2phase-rust 引擎,cs0x7f Kociemba 的 Rust port,~10× 快;4×4 走 cs0x7f Threephase 走 Web Worker 池;5×5 可切到本站 cube555 daemon 真隨機態)。除 WCA 21 項外另接入了三套非 WCA puzzle:cubing.js twizzleEvents 的 5 個(FTO / 四階金字塔 / 二階五魔 / Redi / 二階 FTO);從 cs0x7f csTimer 引擎 vendor 進來的 31 個(齒輪/楓葉/恐龍/Sq2/SSq1/五魔金字塔/六階五魔/直升機/cuboid 5 個/15-puzzle/8-puzzle 等);7 個 shape-mod 借用 WCA scramble(鏡面/費舍爾/三階金字塔/二階金字塔/軸方/風火輪/幽靈/空心)。共 64 個 puzzle,非 WCA 預設摺疊在「其他 ▾」chip 後,點開展示。"
          )}
        </p>

        <h2 className="ga-section-title">{t('三种模式', 'The three modes', "三種模式")}</h2>
        <div className="ga-mode-grid">
          <section className="ga-mode-card">
            <header className="ga-mode-head">
              <h3>{t('比赛 (Comp)', 'Comp', "比賽 (Comp)")}</h3>
              <span className="ga-badge">tnoodle</span>
            </header>
            <p className="ga-mode-tag">
              {t(
                '一张完整的 WCA 比赛打乱表。多项目 + 多轮 + 每轮多组,format / sets / copies 全可配。也能粘 WCA 比赛 id 直接拉已公布的真实打乱。',
                'A full WCA-style scramble sheet — multi-event, multi-round, multi-group, with format / sets / copies all configurable. Or paste a WCA comp id to pull published scrambles.', "一張完整的 WCA 比賽打亂表。多項目 + 多輪 + 每輪多組,format / sets / copies 全可配。也能粘 WCA 比賽 id 直接拉已公佈的真實打亂。"
              )}
            </p>
            <ul className="ga-mode-uses">
              <li>{t('模拟比赛日的全套打乱', 'Mock a competition-day scramble run', "模擬比賽日的全套打亂")}</li>
              <li>{t('做团练 / 周赛 / 模拟赛的打乱表', 'Make club / weekly-comp scramble sheets', "做團練 / 周賽 / 模擬賽的打亂表")}</li>
              <li>{t('回看历史比赛真实打乱(WCA 公布后)', 'Browse real published scrambles from past comps', "回看歷史比賽真實打亂(WCA 公佈後)")}</li>
            </ul>
            <h4 className="ga-mode-out">{t('输出', 'Output', "輸出")}</h4>
            <p className="ga-mode-out-body">{t('网页表格 + tnoodle 风格 PDF(含打乱图,可关)。', 'Web table + tnoodle-style PDF (with preview thumbnails — toggleable).', "網頁表格 + tnoodle 風格 PDF(含打亂圖,可關)。")}</p>
          </section>

          <section className="ga-mode-card">
            <header className="ga-mode-head">
              <h3>{t('批量 (Batch)', 'Batch', "批次 (Batch)")}</h3>
              <span className="ga-badge">quick</span>
            </header>
            <p className="ga-mode-tag">
              {t(
                '选 1 个或多个项目,设个数量 (1-1000),按一次直接出。多项目并排,每项目独立计时基准。',
                'Pick one or more events + a count (1-1000). Multi-event runs in parallel; each event reports its own timing.', "選 1 個或多個項目,設個數量 (1-1000),按一次直接出。多項目並排,每項目獨立計時基準。"
              )}
            </p>
            <ul className="ga-mode-uses">
              <li>{t('日常练打乱集', 'Daily practice scramble sets', "日常練打亂集")}</li>
              <li>{t('做对照实验 / 跑统计的种子', 'Seeds for A/B benchmarks or statistical runs', "做對照實驗 / 跑統計的種子")}</li>
              <li>{t('一键 100 条复制贴到 csTimer / Twisty Timer', 'Copy 100 scrambles into csTimer / Twisty Timer in one go', "一鍵 100 條複製貼到 csTimer / Twisty Timer")}</li>
            </ul>
            <h4 className="ga-mode-out">{t('输出', 'Output', "輸出")}</h4>
            <p className="ga-mode-out-body">{t('每个项目一张表(点行复制单条) + 一键出 PDF。', 'Per-event tables (click a row to copy one scramble) + one-click PDF export.', "每個項目一張表(點行復制單條) + 一鍵出 PDF。")}</p>
          </section>

          <section className="ga-mode-card">
            <header className="ga-mode-head">
              <h3>{t('输入 (Paste)', 'Paste', "輸入 (Paste)")}</h3>
              <span className="ga-badge">manual</span>
            </header>
            <p className="ga-mode-tag">
              {t(
                '自带打乱粘进来,出预览图。容忍 "1. " / "1) " 编号前缀。',
                'Bring your own scrambles, get previews. Tolerates leading "1. " / "1) " numbering.', "自帶打亂粘進來,出預覽圖。容忍 \"1. \" / \"1) \" 編號字首。"
              )}
            </p>
            <ul className="ga-mode-uses">
              <li>{t('要把别处的打乱(老比赛 / 朋友给的)做 PDF', 'Turn scrambles from elsewhere (old comp / a friend) into a PDF', "要把別處的打亂(老比賽 / 朋友給的)做 PDF")}</li>
              <li>{t('看一组特定打乱的 2D net 是什么样', 'Peek at the 2D net of a specific scramble set', "看一組特定打亂的 2D net 是什麼樣")}</li>
              <li>{t('校对粘出来的打乱跟原始一致', 'Sanity-check a paste against its source', "校對粘出來的打亂跟原始一致")}</li>
            </ul>
            <h4 className="ga-mode-out">{t('输出', 'Output', "輸出")}</h4>
            <p className="ga-mode-out-body">{t('实时预览 + 一键出 PDF。', 'Live preview + one-click PDF export.', "實時預覽 + 一鍵出 PDF。")}</p>
          </section>
        </div>

        <h2 className="ga-section-title">{t('比赛模式的流程', 'Comp-mode flow', "比賽模式的流程")}</h2>
        <p className="ga-section-intro">
          {t(
            '配置 → 后台默默预生成 → 点「生成」秒切到查看模式。后台 pool 让点按钮的瞬间几乎不用等。',
            'Configure → background prefetch silently fills a pool → clicking Generate snaps to the view almost instantly because pool drain is free.', "配置 → 後臺默默預生成 → 點「生成」秒切到檢視模式。後臺 pool 讓點按鈕的瞬間幾乎不用等。"
          )}
        </p>
        <div className="ga-flow">
          <Step
            step={1}
            title={t('挑项目', 'Pick events', "挑項目")}
            body={t(
              '21 个 WCA 项目图标里点选,带橙色高亮。也能输入 8-50 加高阶 NxN(8×8 到 50×50 都行,WCA 7 项之外)。',
              'Click one or more of the 21 WCA event icons (orange highlight). Optionally type 8-50 to add a high-order NxN (8×8 to 50×50, beyond WCA\'s 7).', "21 個 WCA 項目圖示裡點選,帶橙色高亮。也能輸入 8-50 加高階 NxN(8×8 到 50×50 都行,WCA 7 項之外)。"
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('调轮数 / 组 / 份 / 赛制', 'Tune rounds / sets / copies / format', "調輪數 / 組 / 份 / 賽制")}
            body={t(
              '再点同一图标加一轮(最多 4 轮);每轮配 format (Ao5 / Mo3 / Bo1 等)、scrambleSets(几组打乱)、copies(印几份)。MBLD 还能调每次魔方数,FM 选翻译语言,clock 选配色。',
              'Click the same icon again to add a round (up to 4); each round has its own format (Ao5 / Mo3 / Bo1 …), scrambleSets (groups), and copies (printed copies). MBLD has cubes-per-attempt; FM picks translation languages; clock picks pin colors.', "再點同一圖示加一輪(最多 4 輪);每輪配 format (Ao5 / Mo3 / Bo1 等)、scrambleSets(幾組打亂)、copies(印幾份)。MBLD 還能調每次魔方數,FM 選翻譯語言,clock 選配色。"
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('后台 pool 默默 top up', 'Background pool silently tops up', "後臺 pool 默默 top up")}
            body={t(
              '配置一改,前端就按当前需求量(总 attempts × cubes × sets)算出每种 scramble 类型缺多少条,默默发起后台生成。这步看不到 UI,但它把 444/555 的 ~3s 剪枝表 build 和单条求解时间挪到「用户读屏」这段空闲里。',
              'On every config change, the client computes how many scrambles of each type are needed (total attempts × cubes × sets) and fires async fills in the background. No UI noise — but the ~3 s 4×4/5×5 pruning-table build and per-scramble solver cost happens during user think-time instead of after a button click.', "配置一改,前端就按當前需求量(總 attempts × cubes × sets)算出每種 scramble 型別缺多少條,默默發起後臺生成。這步看不到 UI,但它把 444/555 的 ~3s 剪枝表 build 和單條求解時間挪到「使用者讀屏」這段空閒裡。"
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('点「生成 (N)」', 'Click "Generate (N)"', "點「生成 (N)」")}
            body={t(
              '能从 pool 拿就直接 shift 出来,几乎零等。pool 没填满的部分回退到现场生成,跟点按钮前一样。生成完页面切到查看模式:顶端 selector 单选切项目,下面是 sheet 表格 + 打乱图预览。',
              'Drain from the pool first (near-zero wait). Anything not yet pooled falls through to live generation. The page then switches to view mode: top selector single-picks an event; sheet table + preview thumbnails below.', "能從 pool 拿就直接 shift 出來,幾乎零等。pool 沒填滿的部分回退到現場生成,跟點按鈕前一樣。生成完頁面切到檢視模式:頂端 selector 單選切項目,下面是 sheet 表格 + 打亂圖預覽。"
            )}
            highlight
          />
          <Arrow />
          <Step
            step={5}
            title={t('看 / 复制 / 下载 PDF', 'View / copy / download PDF', "看 / 複製 / 下載 PDF")}
            body={t(
              '右上「下载 PDF」走 tnoodle 风格 (项目分组 + group / sets / copies header + 打乱图 thumbnail)。需要换比赛或重新配置:左边的清空按钮回配置模式。',
              "Top-right Download PDF emits a tnoodle-style PDF (event grouped, group/sets/copies headers, preview thumbnails). To re-configure: hit the clear button on the left to return to configure mode.", "右上「下載 PDF」走 tnoodle 風格 (項目分組 + group / sets / copies header + 打亂圖 thumbnail)。需要換比賽或重新配置:左邊的清空按鈕回配置模式。"
            )}
          />
        </div>

        <h2 className="ga-section-title">{t('批量 / 输入模式的流程', 'Batch / paste flow', "批次 / 輸入模式的流程")}</h2>
        <p className="ga-section-intro">
          {t(
            '配置即结果。改 events / count 立即重生,看着结果调,不需要确认按钮。',
            'Config is the result. Tweaking events or count triggers an immediate regen; what you see is always live — no "apply" button.', "配置即結果。改 events / count 立即重生,看著結果調,不需要確認按鈕。"
          )}
        </p>
        <div className="ga-flow ga-flow--compact">
          <Step
            step={1}
            title={t('挑项目', 'Pick events', "挑項目")}
            body={t('多选 21 个 WCA 项目里的若干个;高阶 NxN 同 Comp 模式。', 'Multi-pick from the 21 WCA events; high-order NxN works the same as Comp.', "多選 21 個 WCA 項目裡的若干個;高階 NxN 同 Comp 模式。")}
          />
          <Arrow />
          <Step
            step={2}
            title={t('选个数(批量)/ 粘文本(输入)', 'Pick a count (batch) / paste text (paste)', "選個數(批次)/ 粘文字(輸入)")}
            body={t(
              '批量:输入 1-1000 或点 chip(1 / 5 / 12 / 25 / 50 / 100 / 200 / 1000)。输入:每行一条粘到选中项目下方的 textarea。',
              'Batch: type 1-1000 or pick a chip (1 / 5 / 12 / 25 / 50 / 100 / 200 / 1000). Paste: one scramble per line into each event\'s textarea.', "批次:輸入 1-1000 或點 chip(1 / 5 / 12 / 25 / 50 / 100 / 200 / 1000)。輸入:每行一條粘到選中項目下方的 textarea。"
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('实时显示', 'Live render', "實時顯示")}
            body={t(
              '改一下马上重生 / 重渲。每个 event 各自统计 wall / avg / first 三个时间,可以一眼看出哪种打乱在你机器上慢。',
              'Any change re-renders instantly. Per-event timing (wall / avg / first) lets you see at a glance which scrambler is slow on your machine.', "改一下馬上重生 / 重渲。每個 event 各自統計 wall / avg / first 三個時間,可以一眼看出哪種打亂在你機器上慢。"
            )}
            highlight
          />
        </div>

        <h2 className="ga-section-title">{t('引擎选择', 'Engine selection', "引擎選擇")}</h2>
        <div className="ga-engine-table-wrap">
          <table className="ga-engine-table">
            <thead>
              <tr>
                <th>{t('项目', 'Event', "項目")}</th>
                <th>{t('引擎', 'Engine')}</th>
                <th>{t('生成位置', 'Where')}</th>
                <th>{t('特点', 'Notes', "特點")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>3×3</td>
                <td>{t('cubing.js (默认) 或 min2phase-rust', 'cubing.js (default) or min2phase-rust', "cubing.js (預設) 或 min2phase-rust")}</td>
                <td>{t('浏览器 (WASM)', 'browser (WASM)', "瀏覽器 (WASM)")}</td>
                <td>
                  {t(
                    '默认 cubing.js TS 实现;切到 min2phase-rust(cs0x7f Kociemba 的 Rust port,117 KB WASM 懒加载)~10× 快,长度分布同算法等价。',
                    'Default: cubing.js TS impl. Toggle to min2phase-rust (cs0x7f Kociemba ported to Rust, 117 KB WASM lazy-loaded) for ~10× speed, equivalent length distribution.', "預設 cubing.js TS 實現;切到 min2phase-rust(cs0x7f Kociemba 的 Rust port,117 KB WASM 懶載入)~10× 快,長度分佈同演算法等價。"
                  )}
                </td>
              </tr>
              <tr>
                <td>2×2 / 3×3 BLD / OH / FT / FM / MBLD</td>
                <td>cubing.js</td>
                <td>{t('浏览器', 'browser', "瀏覽器")}</td>
                <td>{t('真随机状态,毫秒级', 'random-state, millisecond', "真隨機狀態,毫秒級")}</td>
              </tr>
              <tr>
                <td>4×4</td>
                <td>cs0x7f Threephase</td>
                <td>{t('浏览器 Web Worker 池', 'browser Web Worker pool', "瀏覽器 Web Worker 池")}</td>
                <td>{t('真随机状态,冷启 ~3s 剪枝表,池满后秒级', 'random-state; ~3 s cold table build, then ms once pool is warm', "真隨機狀態,冷啟 ~3s 剪枝表,池滿後秒級")}</td>
              </tr>
              <tr>
                <td>5×5</td>
                <td>{t('cubing.js (默认) 或 cube555 daemon', 'cubing.js (default) or cube555 daemon', "cubing.js (預設) 或 cube555 daemon")}</td>
                <td>{t('浏览器 / 服务器', 'browser / server', "瀏覽器 / 伺服器")}</td>
                <td>
                  {t('默认 WCA 标准 60 步随机转动;切到「随机状态」走服务器,~70 步真均匀。', 'Default is the WCA 60-move random-move; toggle to "random-state" for the server (~70 moves, uniform).', "預設 WCA 標準 60 步隨機轉動;切到「隨機狀態」走伺服器,~70 步真均勻。")}
                  {' '}
                  <Link href="/scramble/555-about">{t('详情', 'details', "詳情")}</Link>
                </td>
              </tr>
              <tr>
                <td>6×6 / 7×7</td>
                <td>cubing.js</td>
                <td>{t('浏览器', 'browser', "瀏覽器")}</td>
                <td>{t('WCA 标准 80 / 100 步随机转动', 'WCA 80 / 100 random-move', "WCA 標準 80 / 100 步隨機轉動")}</td>
              </tr>
              <tr>
                <td>{t('高阶 N×N (N ≥ 8)', 'high-order N×N (N ≥ 8)', "高階 N×N (N ≥ 8)")}</td>
                <td>{t('自带随机转动(线性 20·(N-2))', 'in-house random-move (linear 20·(N-2))', "自帶隨機轉動(線性 20·(N-2))")}</td>
                <td>{t('浏览器', 'browser', "瀏覽器")}</td>
                <td>{t('WCA 没规范,模仿 5/6/7 的轴防压缩规则', 'No WCA spec; mirrors the same-axis rejection used by 5/6/7', "WCA 沒規範,模仿 5/6/7 的軸防壓縮規則")}</td>
              </tr>
              <tr>
                <td>{t('Pyraminx / Skewb / Sq-1 / Megaminx / Clock', 'Pyraminx / Skewb / Sq-1 / Megaminx / Clock')}</td>
                <td>cubing.js</td>
                <td>{t('浏览器', 'browser', "瀏覽器")}</td>
                <td>{t('随机状态(各 puzzle 独立 solver)', 'random-state (per-puzzle solver)', "隨機狀態(各 puzzle 獨立 solver)")}</td>
              </tr>
              <tr>
                <td>{t('非 WCA:FTO / 四阶金字塔 / 二阶五魔 / Redi / 二阶 FTO', 'Non-WCA: FTO / Master Tetra / Kilominx / Redi / Baby FTO', "非 WCA:FTO / 四階金字塔 / 二階五魔 / Redi / 二階 FTO")}</td>
                <td>cubing.js</td>
                <td>{t('浏览器', 'browser', "瀏覽器")}</td>
                <td>
                  {t(
                    '随机状态(cubing.js twizzleEvents)',
                    'Random-state (cubing.js twizzleEvents)', "隨機狀態(cubing.js twizzleEvents)"
                  )}
                </td>
              </tr>
              <tr>
                <td>{t('非 WCA:齿轮/枫叶/恐龙/Sq2/SSq1/BSq1/六阶五魔/五魔金字塔/直升机/弧面直升机/大金字塔(随态)/2×2×3/1×3×3/2×3×3/3×3×4/3×3×5/3×3×6/3×3×7/15-puzzle/8-puzzle/SFl/UFO/Ico/Crazy/Cm3/Cm2/Bic/Sia113/Sia123/Sia222/Dmd', 'Non-WCA: Gear / Ivy / Dino / Sq2 / SSq1 / BSq1 / Gigaminx / Pyraminx Crystal / Helicopter / Curvy Copter / Master Pyra RS / 2×2×3 / 1×3×3 / 2×3×3 / 3×3×4-7 / 15-puzzle / 8-puzzle / Super Floppy / UFO / Icosamate / Crazy 3×3 / Cmetrick / Cmetrick Mini / Bicube / Siamese ×3 / Diamond', "非 WCA:齒輪/楓葉/恐龍/Sq2/SSq1/BSq1/六階五魔/五魔金字塔/直升機/弧面直升機/大金字塔(隨態)/2×2×3/1×3×3/2×3×3/3×3×4/3×3×5/3×3×6/3×3×7/15-puzzle/8-puzzle/SFl/UFO/Ico/Crazy/Cm3/Cm2/Bic/Sia113/Sia123/Sia222/Dmd")}</td>
                <td>cs0x7f csTimer</td>
                <td>{t('浏览器 Web Worker', 'browser Web Worker', "瀏覽器 Web Worker")}</td>
                <td>
                  {t(
                    '上游源码 vendor 在 tools/cstimer-scramble/(GPLv3);classic worker importScripts 整套 lib + scramble file。13 个随机态(IDA + 运行时建剪枝表),18 个随机转动。冷启 ~100-300ms,热路径 < 50ms。',
                    'Upstream source vendored at tools/cstimer-scramble/ (GPLv3); classic worker importScripts the full lib + scramble files. 13 random-state (IDA + runtime prune tables), 18 random-move. Cold start ~100-300 ms, hot path < 50 ms.', "上游原始碼 vendor 在 tools/cstimer-scramble/(GPLv3);classic worker importScripts 整套 lib + scramble file。13 個隨機態(IDA + 執行時建剪枝表),18 個隨機轉動。冷啟 ~100-300ms,熱路徑 < 50ms。"
                  )}
                </td>
              </tr>
              <tr>
                <td>{t('Shape-mod:镜面/费舍尔/三阶金字塔/二阶金字塔/轴方/风火轮/幽灵/空心', 'Shape mods: Mirror Blocks / Fisher / Mastermorphix / Pyramorphix / Axis / Windmill / Ghost / Void', "Shape-mod:鏡面/費舍爾/三階金字塔/二階金字塔/軸方/風火輪/幽靈/空心")}</td>
                <td>{t('共享 WCA scramble', 'borrows WCA scramble')}</td>
                <td>{t('浏览器', 'browser', "瀏覽器")}</td>
                <td>
                  {t(
                    '本身是 3×3(或 2×2,Pyramorphix)的 sticker-shape 变体,cube state 跟原 puzzle 完全一致 → 直接复用对应 WCA 池的打乱,零额外算法。预览也按底层 puzzle 的 unfolded net 画。',
                    'Sticker-shape variants of 3×3 (or 2×2 for Pyramorphix) — same underlying cube state, so we route to the WCA pool with zero extra algorithm. Preview renders the underlying puzzle\'s unfolded net.', "本身是 3×3(或 2×2,Pyramorphix)的 sticker-shape 變體,cube state 跟原 puzzle 完全一致 → 直接複用對應 WCA 池的打亂,零額外演算法。預覽也按底層 puzzle 的 unfolded net 畫。"
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="ga-section-title">{t('3×3 引擎对比', '3×3 engine comparison', "3×3 引擎對比")}</h2>
        <p className="ga-section-intro">
          {t(
            '页面里选了 3×3 时,会出现一个 toggle 让你在两个引擎之间切。算法都是 Kociemba two-phase,只是实现不同 — 解出来的打乱步数分布几乎完全相同(±0.1 步),但生成速度差一个量级。同一台机器、同一标签页、各预热完后跑 100 个 random-state 打乱的实测:',
            'When 3×3 is selected, a toggle appears to switch between the two engines. Both are Kociemba two-phase; only the implementation differs. Length distribution is essentially identical (±0.1 moves), but generation speed differs by an order of magnitude. Same machine, same tab, post-warmup, 100 random-state scrambles each:', "頁面裡選了 3×3 時,會出現一個 toggle 讓你在兩個引擎之間切。演算法都是 Kociemba two-phase,只是實現不同 — 解出來的打亂步數分佈幾乎完全相同(±0.1 步),但生成速度差一個量級。同一臺機器、同一標籤頁、各預熱完後跑 100 個 random-state 打亂的實測:"
          )}
        </p>
        <div className="ga-engine-table-wrap">
          <table className="ga-engine-table">
            <thead>
              <tr>
                <th>{t('指标', 'Metric', "指標")}</th>
                <th>cubing.js (WCA)</th>
                <th>min2phase-rust</th>
                <th>{t('m2p 倍速', 'm2p speedup')}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>{t('平均', 'avg')}</td><td>20.61 ms</td><td>1.44 ms</td><td>14.3×</td></tr>
              <tr><td>p50</td><td>12.42 ms</td><td>1.21 ms</td><td>10.3×</td></tr>
              <tr><td>p95</td><td>60.01 ms</td><td>3.49 ms</td><td>17.2×</td></tr>
              <tr><td>max</td><td>250.63 ms</td><td>18.23 ms</td><td>13.7×</td></tr>
              <tr><td>{t('平均长度', 'avg length', "平均長度")}</td><td>20.49</td><td>20.53</td><td>{t('~ 同', '~ same')}</td></tr>
              <tr><td>{t('首次冷启', 'cold start', "首次冷啟")}</td><td>{t('~3 s(prewarm 后 ~30 ms)', '~3 s (with prewarm ~30 ms)', "~3 s(prewarm 後 ~30 ms)")}</td><td>{t('~120 ms(含 WASM fetch)', '~120 ms (incl. WASM fetch)')}</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
        <p className="ga-section-intro">
          {t(
            '为啥不直接换默认?WCA 官方那套是 Lucas Garron 的实现,生态默认值,保守不变默认。要更快就在 3×3 picker 里点切换,localStorage 持久。切换会清相应 pool,下一次 Generate 用新引擎填池。',
            "Why not just switch defaults? cubing.js is Lucas Garron's implementation, the ecosystem default, and we keep it. Toggle in the 3×3 picker if you want speed; localStorage persists the choice. Switching clears the relevant pool so the next Generate refills with the new engine.", "為啥不直接換預設?WCA 官方那套是 Lucas Garron 的實現,生態預設值,保守不變預設。要更快就在 3×3 picker 裡點切換,localStorage 持久。切換會清相應 pool,下一次 Generate 用新引擎填池。"
          )}
        </p>

        <h2 className="ga-section-title">{t('快的秘密:三层池子', 'Why it feels fast: three layers of pool', "快的秘密:三層池子")}</h2>
        <ul className="ga-pool-list">
          <li>
            <strong>{t('prewarm 启动钩:', 'prewarm on mount:', "prewarm 啟動鉤:")}</strong>
            {t(
              ' 进 /scramble/gen 就触发 333 / 444 / 555 的剪枝表 build,跟用户挑项目并行。第一次点 Generate 不再等 ~3s 冷启。',
              ' Landing on /scramble/gen kicks off the 333 / 444 / 555 pruning-table build in parallel with the user picking events. The first Generate click no longer eats a ~3 s cold start.', " 進 /scramble/gen 就觸發 333 / 444 / 555 的剪枝表 build,跟使用者挑項目並行。第一次點 Generate 不再等 ~3s 冷啟。"
            )}
          </li>
          <li>
            <strong>{t('cubing.js immediate prefetch:', 'cubing.js immediate prefetch:')}</strong>
            {t(
              ' 配 scramblePrefetchLevel: \'immediate\',一条打乱解出来下一条就开始(默认是 1s idle 才开)。连点 Generate 第 2、3 次基本零等。',
              " We set scramblePrefetchLevel: 'immediate' so the next scramble starts solving the instant the previous one resolves (default is 1 s idle). Click-click-click feels free.", " 配 scramblePrefetchLevel: 'immediate',一條打亂解出來下一條就開始(預設是 1s idle 才開)。連點 Generate 第 2、3 次基本零等。"
            )}
          </li>
          <li>
            <strong>{t('应用层池 (cubingScramble.ts):', 'App-level pool (cubingScramble.ts):', "應用層池 (cubingScramble.ts):")}</strong>
            {t(
              ' 每个项目维护 N 条已生成 scramble。pop 一条立刻 schedule 补一条;4×4 池 25,5×5 池 5,其余 3。',
              ' Each event keeps N pre-generated scrambles. Pop one, schedule a refill; 4×4 pool = 25, 5×5 = 5, others = 3.', " 每個項目維護 N 條已生成 scramble。pop 一條立刻 schedule 補一條;4×4 池 25,5×5 池 5,其餘 3。"
            )}
          </li>
          <li>
            <strong>{t('Comp 模式专属:per-config 大池 (TNoodleMode):', 'Comp-only per-config pool (TNoodleMode):', "Comp 模式專屬:per-config 大池 (TNoodleMode):")}</strong>
            {t(
              ' 在配置 events / rounds / sets 时,后台按当前需求量预生成到「正好够用」。点 Generate 几乎就是从池里 shift。',
              ' While configuring events / rounds / sets, the page prefetches "exactly enough" in the background. Generate then becomes mostly a pool drain.', " 在配置 events / rounds / sets 時,後臺按當前需求量預生成到「正好夠用」。點 Generate 幾乎就是從池裡 shift。"
            )}
          </li>
        </ul>

        <h2 className="ga-section-title">{t('相关页面', 'See also', "相關頁面")}</h2>
        <ul className="ga-refs">
          <li>
            <Link href="/scramble/555-about">{t('5×5 打乱方法对照', '5×5 scramble methods', "5×5 打亂方法對照")}</Link>
            {t(' — 随机转动 vs 随机状态,以及 cube555 daemon 的 5 个 phase 怎么跑。', " — random-move vs random-state, plus the 5 phases of the cube555 daemon.", " — 隨機轉動 vs 隨機狀態,以及 cube555 daemon 的 5 個 phase 怎麼跑。")}
          </li>
          <li>
            <Link href="/scramble/analyzer">{t('CFOP 打乱分析器', 'CFOP scramble analyzer', "CFOP 打亂分析器")}</Link>
            {t(' — 拿一条 3×3 打乱看 cross / F2L 各步的最佳解法长度。', ' — feed one 3×3 scramble, see optimal cross / F2L lengths per step.', " — 拿一條 3×3 打亂看 cross / F2L 各步的最佳解法長度。")}
          </li>
          <li>
            <Link href="/scramble/solver">{t('Solver demo', 'Solver demo')}</Link>
            {t(' — Kociemba two-phase 在浏览器跑的可视化。', " — Kociemba two-phase running visually in the browser.", " — Kociemba two-phase 在瀏覽器跑的視覺化。")}
          </li>
          <li>
            <a href="https://www.cubing.net/cubing.js/" target="_blank" rel="noopener noreferrer">cubing.js</a>
            {t(' — Lucas Garron 的浏览器 cubing 全家桶,本站 WCA + 5 个 twizzle 项目走这里。', " — Lucas Garron's in-browser cubing stack; WCA + 5 twizzle non-WCA events flow through it.", " — Lucas Garron 的瀏覽器 cubing 全家桶,本站 WCA + 5 個 twizzle 項目走這裡。")}
          </li>
          <li>
            <a href="https://github.com/cs0x7f/cstimer" target="_blank" rel="noopener noreferrer">cs0x7f/csTimer</a>
            {t(' — 非 WCA 31 个 puzzle 的打乱引擎来源(GPLv3),vendor 在 tools/cstimer-scramble/。', ' — Source of the 31 non-WCA puzzle scramble engines (GPLv3), vendored at tools/cstimer-scramble/.', " — 非 WCA 31 個 puzzle 的打亂引擎來源(GPLv3),vendor 在 tools/cstimer-scramble/。")}
          </li>
          <li>
            <a href="https://github.com/RuiminYan/min2phase-rust" target="_blank" rel="noopener noreferrer">RuiminYan/min2phase-rust</a>
            {t(' — 本站的 3×3 可选引擎。cs0x7f 原版 Java min2phase 的 Rust port,WASM 117 KB,~20% 比 Java 还快。GPL-3.0。', " — This site's 3×3 alt engine. Rust port of cs0x7f's Java min2phase, WASM 117 KB, ~20% faster than the Java original. GPL-3.0.", " — 本站的 3×3 可選引擎。cs0x7f 原版 Java min2phase 的 Rust port,WASM 117 KB,~20% 比 Java 還快。GPL-3.0。")}
          </li>
          <li>
            <a href="https://www.worldcubeassociation.org/regulations/#article-4-scrambling" target="_blank" rel="noopener noreferrer">{t('WCA Regulation §4: Scrambling', 'WCA Regulation §4: Scrambling')}</a>
            {t(' — 比赛打乱标准的来源(各项目长度、随机转动 vs 随机状态的规定)。', ' — the source of competition scramble rules (per-event length, random-move vs random-state allowances).', " — 比賽打亂標準的來源(各項目長度、隨機轉動 vs 隨機狀態的規定)。")}
          </li>
        </ul>
      </main>
    </div>
  );
}
