'use client';

import { useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../../_lib/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './gan-ble.css';

const ACCENT = '#4C6EF5';

// Real base key / IV from timer/_lib/bluetooth/gan_v2.ts (= v3/v4, cstimer KEYS[2]/KEYS[3]).
const KEY_BASE = ['01', '02', '42', '28', '31', '91', '16', '07', '20', '05', '18', '54', '42', '11', '12', '53'];
const IV_BASE = ['11', '03', '32', '28', '21', '01', '76', '27', '20', '95', '78', '14', '32', '12', '02', '43'];

interface Stage {
  key: string;
  no: string;
  zh: { title: string; one: string; detail: string };
  en: { title: string; one: string; detail: string };
  code?: string;
}

const STAGES: Stage[] = [
  {
    key: 'capture',
    no: '01',
    zh: {
      title: '截获密文',
      one: 'notify 特征值推来 20 字节密文',
      detail: '魔方每转一下，就在 BLE 的 notify 特征值上推一帧。浏览器侧监听 characteristicvaluechanged，拿到的是一个 DataView——整帧都是加密的字节，直接读没有任何意义。',
    },
    en: {
      title: 'Capture ciphertext',
      one: 'A 20-byte frame lands on the notify characteristic',
      detail: 'Every turn the cube pushes one frame on its BLE notify characteristic. The browser listens for characteristicvaluechanged and gets a DataView of raw, fully-encrypted bytes — reading them directly is meaningless.',
    },
    code: "notifyChar.addEventListener('characteristicvaluechanged', onChar);\nconst ct = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);",
  },
  {
    key: 'derive',
    no: '02',
    zh: {
      title: '派生密钥',
      one: '固定基底 + 反序 MAC，模 255',
      detail: '每个魔方的 AES 密钥和 IV 都不一样：拿一组固定的 16 字节基底，把这个魔方 MAC 地址的 6 个字节倒着叠加到前 6 字节上。注意是「模 255」不是模 256，也不是异或——这是 GAN 的怪癖，照搬成 XOR 的移植在真机上全崩。',
    },
    en: {
      title: 'Derive the key',
      one: 'Fixed base + reversed MAC, modulo 255',
      detail: "Each cube's AES key and IV are unique: take a fixed 16-byte base and fold the cube's 6 MAC bytes — in reverse — into the first six. Crucially it's addition modulo 255, not 256, and not XOR. That quirk is why XOR-based ports silently fail on real hardware.",
    },
    code: 'key[i] = (base[i] + mac[5 - i]) % 255;   // i in 0..5\n// bytes 6..15 stay untouched; IV derives the same way',
  },
  {
    key: 'decrypt',
    no: '03',
    zh: {
      title: 'AES 解密',
      one: 'AES-128 滚动窗口，两遍',
      detail: '不是教科书 CBC。对 >16 字节的帧：先解最后 16 字节（ECB 块）再和 IV 异或，再解最前 16 字节同样异或。20 字节帧里中间 12 字节被两遍都碰到——这就是滚动窗口的重叠。整套 AES 是纯 TS 同步实现，避免等 Promise 时丢帧。',
    },
    en: {
      title: 'AES decrypt',
      one: 'AES-128 in a rolling two-pass window',
      detail: "Not textbook CBC. For frames over 16 bytes: decrypt the trailing 16 (ECB block) and XOR with the IV, then decrypt the leading 16 and XOR again. In a 20-byte frame the middle 12 bytes are touched by both passes — that overlap is the rolling window. The whole AES is a synchronous pure-TS implementation so the BLE handler never drops a frame waiting on a Promise.",
    },
    code: 'if (len > 16) { decrypt(out[len-16 .. len]); xor IV; }\ndecrypt(out[0 .. 16]); xor IV;',
  },
  {
    key: 'parse',
    no: '04',
    zh: {
      title: '解析位串',
      one: '大端拼成位串，按 mode 分派',
      detail: '解出的明文按字节拼成一条大端「0/1」位串，再按位切片读无符号整数。头部几位是 mode：转动事件 / 电量 / facelet 快照 / 陀螺仪 / 硬件信息各走一支。move 帧带一个会回绕的计数器，用来对齐丢帧。',
    },
    en: {
      title: 'Parse the bit-string',
      one: 'Concatenate big-endian bits, dispatch on mode',
      detail: 'The plaintext is concatenated into one big-endian "0/1" bit-string, then sliced bitwise into unsigned integers. The leading bits are a mode selector: move event, battery, facelet snapshot, gyro, hardware-info each branch off. Move frames carry a wrapping counter used to realign after dropped frames.',
    },
    code: "value += (byte + 256).toString(2).slice(1); // 8 bits/byte\nmode = bit(0, 4);  moveCnt = bit(4, 12);",
  },
  {
    key: 'moves',
    no: '05',
    zh: {
      title: '解出转动',
      one: '面 + 方向 → R U R′',
      detail: '每个 5 位编码 = 面索引（查 "URFDLB"）左移一位再或上方向（0 顺 / 1 逆）。move 帧带最近 7 个四分之一转的滑动窗口，[0] 最新。流里只有四分之一转，180° 拆成两个连续四分之一转。最终吐出 WCA 记号，host 端再据此重建整颗魔方状态。',
    },
    en: {
      title: 'Emit moves',
      one: 'face + direction → R U R′',
      detail: 'Each 5-bit code = a face index (into "URFDLB") shifted left, OR\'d with a direction bit (0 = CW, 1 = CCW). A move frame carries a sliding window of the last 7 quarter-turns, [0] the newest. The stream is quarter-turn only — a 180° turn arrives as two consecutive quarter-turns. The result is WCA notation; the host re-models the whole cube state from that move stream.',
    },
    code: 'face = "URFDLB"[code >> 1];\ndir  = (code & 1) ? "′" : "";   // CCW : CW',
  },
];

interface VCell {
  zh: string;
  en: string;
}
interface VRow {
  label: VCell;
  v2: VCell;
  v3: VCell;
  v4: VCell;
}

const VROWS: VRow[] = [
  {
    label: { zh: '覆盖机型', en: 'Cubes' },
    v2: { zh: '356 i / i Carry / i Play、MG / Mini、AiCube 克隆', en: '356 i / i Carry / i Play, MG / Mini, AiCube clones' },
    v3: { zh: '356 i3 / i Play / 357 Play (≈2022 固件)', en: '356 i3 / i Play / 357 Play (≈2022 firmware)' },
    v4: { zh: 'GAN 12 / 13 / 14、Mini Pro', en: 'GAN 12 / 13 / 14, Mini Pro' },
  },
  {
    label: { zh: 'GATT 服务', en: 'GATT service' },
    v2: { zh: 'Nordic UART  6e400001-…', en: 'Nordic UART  6e400001-…' },
    v3: { zh: '8653000a-…', en: '8653000a-…' },
    v4: { zh: '00000010-…-fff5fff4fff0', en: '00000010-…-fff5fff4fff0' },
  },
  {
    label: { zh: 'notify / write', en: 'notify / write' },
    v2: { zh: '28be4cb6 / 28be4a4a', en: '28be4cb6 / 28be4a4a' },
    v3: { zh: '8653000b / 8653000c', en: '8653000b / 8653000c' },
    v4: { zh: 'fff6 / fff5', en: 'fff6 / fff5' },
  },
  {
    label: { zh: '转动事件', en: 'Move event' },
    v2: { zh: 'mode 2 + 7 步滑动窗口', en: 'mode 2 + 7-move sliding window' },
    v3: { zh: 'mode 1 + 单步轴 one-hot', en: 'mode 1 + single-move axis one-hot' },
    v4: { zh: 'mode 0x01 + 单步轴 one-hot', en: 'mode 0x01 + single-move axis one-hot' },
  },
  {
    label: { zh: '丢帧恢复', en: 'Drop recovery' },
    v2: { zh: '8 位计数器对齐', en: '8-bit counter alignment' },
    v3: { zh: 'mode 6 历史回放 (轴序 DUBFLR)', en: 'mode 6 history replay (axis DUBFLR)' },
    v4: { zh: 'mode 0xD1 历史回放 (轴序 DUBFLR)', en: 'mode 0xD1 history replay (axis DUBFLR)' },
  },
  {
    label: { zh: '电量 / facelet', en: 'Battery / facelets' },
    v2: { zh: 'mode 9 / mode 4', en: 'mode 9 / mode 4' },
    v3: { zh: 'mode 16 / mode 2', en: 'mode 16 / mode 2' },
    v4: { zh: 'mode 0xEF / mode 0xED', en: 'mode 0xEF / mode 0xED' },
  },
];

interface MacStep {
  no: string;
  zh: { title: string; desc: string };
  en: { title: string; desc: string };
}

const MAC_CHAIN: MacStep[] = [
  {
    no: '1',
    zh: { title: '广播厂商数据', desc: 'watchAdvertisements() 监听广播包，从 manufacturer data 里抠 MAC（取末 6 字节倒序）。要 optionalManufacturerData + 浏览器开实验开关。CIC 列表覆盖 0x0001..0xFF01 共 256 个值，因为 GAN 跨固件批次换过厂商标识。' },
    en: { title: 'Advertisement manufacturer data', desc: 'watchAdvertisements() listens to advertisement packets and lifts the MAC from manufacturer data (last 6 bytes, reversed). Needs optionalManufacturerData plus an experimental browser flag. The CIC list spans 0x0001..0xFF01 (256 values) because GAN changed its company identifier across firmware batches.' },
  },
  {
    no: '2',
    zh: { title: '设备名里的 MAC', desc: '部分 GAN 名字以完整 12 位十六进制结尾（"GAN-…-AABBCCDDEEFF"）。只信完整 6 字节——绝不拿 3 字节后缀去拼一个猜测的 OUI，因为 GAN 有多个 OUI，猜错就静默解出垃圾。' },
    en: { title: 'MAC embedded in the name', desc: 'Some GAN names end in a full 12-hex MAC ("GAN-…-AABBCCDDEEFF"). We trust only a full 6-byte MAC — never fabricate one from a 3-byte suffix plus a guessed OUI, since GAN uses several OUIs and a wrong guess silently decrypts to garbage.' },
  },
  {
    no: '3',
    zh: { title: '上次手输并存下的', desc: '用户曾经手输过的 MAC 按设备名存在 localStorage（cuberoot.timer.ganMacMap），下次直接复用。' },
    en: { title: 'A previously saved manual MAC', desc: 'A MAC the user typed before is stored per device name in localStorage (cuberoot.timer.ganMacMap) and reused next time.' },
  },
  {
    no: '4',
    zh: { title: '手动输入', desc: '以上全失败就弹窗让用户照着魔方自带的卡片 / cstimer 输入 MAC。零 MAC 兜底只在极少数早期固件上能用，其余一律垃圾。' },
    en: { title: 'Manual prompt', desc: 'If all else fails, prompt the user to type the MAC (from the cube’s card or cstimer). A zero-MAC fallback works on a tiny subset of pre-MAC firmware and is garbage on the rest.' },
  },
];

function ByteGrid({ bytes, label }: { bytes: string[]; label: React.ReactNode }) {
  return (
    <div className="ganble-bytes">
      <div className="ganble-bytes-label">{label}</div>
      <div className="ganble-bytes-grid">
        {bytes.map((b, i) => (
          <span key={i} className={'ganble-byte' + (i < 6 ? ' ganble-byte-hot' : '')}>{b}</span>
        ))}
      </div>
    </div>
  );
}

export default function GanBlePage() {
  const { i18n } = useTranslation();
  const lang: Lang = (['en', 'zh'] as const)[Number(i18n.language.startsWith('zh'))];
  const [stage, setStage] = useState(1); // default-highlight the "derive key" step

  useDocumentTitle('GAN 蓝牙协议与 AES 解密', 'GAN BLE protocol & AES');

  const active = STAGES[stage];
  const at = active[lang];

  return (
    <LangCtx.Provider value={lang}>
      <div className="ganble-page" style={{ ['--accent' as string]: ACCENT }}>
        <div className="ganble-grid-bg" />
        <div className="ganble-inner">
          <div className="ganble-topbar">
            <Link href="/code/algorithms" className="ganble-back">← /code/algorithms</Link>
            <span className="ganble-tag">AES-128-ECB</span>
          </div>

          <header className="ganble-hero">
            <div className="ganble-hero-jargon" aria-hidden>
              <span>Nordic UART</span><span>watchAdvertisements()</span><span>mod 255</span>
              <span>reversed MAC</span><span>rolling window</span><span>company-id</span><span>SBOX</span>
            </div>
            <h1 className="ganble-title">
              <L zh="GAN 智能魔方蓝牙协议与 AES 解密" en="GAN smart cube: BLE protocol & AES" />
            </h1>
            <p className="ganble-lede">
              <L
                zh="一颗 GAN 智能魔方每转一下，就在蓝牙上推一帧加密字节。要在浏览器里把它变成 R U R′，得先解决一个 GAN 没打算让你解决的问题：每颗魔方的 AES 密钥都从它的 MAC 地址派生——而 Web Bluetooth 故意不给你 MAC。"
                en="Every turn, a GAN smart cube pushes one frame of encrypted bytes over Bluetooth. Turning that into R U R′ in a browser means solving a problem GAN never meant you to solve: each cube's AES key is derived from its MAC address — and Web Bluetooth deliberately hides the MAC."
              />
            </p>
            <div className="ganble-herostats">
              <div><b>3</b><span><L zh="代协议 v2/v3/v4" en="protocol gens v2/v3/v4" /></span></div>
              <div><b>AES-128</b><span><L zh="纯 TS 同步实现" en="pure-TS, synchronous" /></span></div>
              <div><b>mod 255</b><span><L zh="不是 256，不是 XOR" en="not 256, not XOR" /></span></div>
              <div><b>0</b><span><L zh="浏览器拿得到的 MAC" en="MAC the browser hands you" /></span></div>
            </div>
          </header>

          {/* The central difficulty */}
          <section className="ganble-puzzle">
            <h2 className="ganble-h2"><L zh="核心难题：浏览器看不见 MAC" en="The core problem: the browser can't see the MAC" /></h2>
            <div className="ganble-puzzle-row">
              <div className="ganble-puzzle-card ganble-puzzle-native">
                <div className="ganble-puzzle-head"><L zh="原生 App" en="Native app" /></div>
                <code>BluetoothDevice.getAddress()</code>
                <p><L zh="直接读到真实 MAC，密钥派生一步到位。" en="Reads the real MAC directly — key derivation is trivial." /></p>
                <span className="ganble-ok">MAC ✓</span>
              </div>
              <div className="ganble-puzzle-card ganble-puzzle-web">
                <div className="ganble-puzzle-head"><L zh="Web Bluetooth" en="Web Bluetooth" /></div>
                <code>device.id = <L zh="按来源随机化的 token" en="randomized per-origin token" /></code>
                <p><L zh="规范刻意隐藏 MAC。没有 MAC，AES 密钥就派生不出来，解出来全是垃圾。" en="The spec deliberately hides the MAC. Without it the AES key can't be derived and everything decrypts to garbage." /></p>
                <span className="ganble-bad">MAC ✗</span>
              </div>
            </div>
            <p className="ganble-puzzle-note">
              <L
                zh="解法是一条降级链：广播包 → 设备名 → 存档 → 手输。任何一步拿到 MAC 就能开锁。"
                en="The workaround is a fallback ladder: advertisement → device name → saved → manual. Any one of them yields the MAC and unlocks the stream."
              />
            </p>
          </section>

          {/* Decrypt pipeline — the centerpiece */}
          <section className="ganble-pipe-section">
            <h2 className="ganble-h2"><L zh="一帧从密文到转动" en="One frame, from ciphertext to a turn" /></h2>
            <p className="ganble-sub"><L zh="点任一阶段看它在做什么。" en="Tap any stage to see what it does." /></p>
            <div className="ganble-pipe" role="tablist">
              {STAGES.map((s, i) => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={i === stage}
                  className={'ganble-pipe-step' + (i === stage ? ' active' : '')}
                  onClick={() => setStage(i)}
                >
                  <span className="ganble-pipe-no">{s.no}</span>
                  <span className="ganble-pipe-title">{s[lang].title}</span>
                  <span className="ganble-pipe-one">{s[lang].one}</span>
                  {i < STAGES.length - 1 && <span className="ganble-pipe-arrow" aria-hidden>→</span>}
                </button>
              ))}
            </div>
            <div className="ganble-pipe-detail">
              <div className="ganble-pipe-detail-no">{active.no}</div>
              <div className="ganble-pipe-detail-body">
                <h3>{at.title}</h3>
                <p>{at.detail}</p>
                {active.code && <pre className="ganble-code">{active.code}</pre>}
              </div>
            </div>
          </section>

          {/* Key derivation focus */}
          <section className="ganble-keys">
            <h2 className="ganble-h2"><L zh="密钥怎么长出来" en="How the key is grown" /></h2>
            <p className="ganble-sub">
              <L
                zh="所有正常 GAN 共用同一组 16 字节基底（cstimer 的 KEYS[2]/KEYS[3]），只有前 6 字节被 MAC 改写。AiCube 克隆用另一组基底。"
                en="All normal GAN cubes share one 16-byte base (cstimer's KEYS[2]/KEYS[3]); only the first six bytes get rewritten by the MAC. AiCube clones use a different base."
              />
            </p>
            <ByteGrid bytes={KEY_BASE} label={<L zh="KEY 基底（前 6 字节会被 MAC 叠加）" en="KEY base (first 6 bytes get the MAC folded in)" />} />
            <ByteGrid bytes={IV_BASE} label={<L zh="IV 基底" en="IV base" />} />
            <pre className="ganble-code ganble-code-formula">{`for (i = 0; i < 6; i++)
    key[i] = (base[i] + mac[5 - i]) % 255;   // mod 255, GAN's quirk`}</pre>
          </section>

          {/* Version comparison */}
          <section className="ganble-versions">
            <h2 className="ganble-h2"><L zh="三代协议" en="Three protocol generations" /></h2>
            <div className="ganble-vtable-wrap">
              <table className="ganble-vtable">
                <thead>
                  <tr>
                    <th />
                    <th>v2</th>
                    <th>v3</th>
                    <th>v4</th>
                  </tr>
                </thead>
                <tbody>
                  {VROWS.map((r, i) => (
                    <tr key={i}>
                      <th scope="row">{r.label[lang]}</th>
                      <td>{r.v2[lang]}</td>
                      <td>{r.v3[lang]}</td>
                      <td>{r.v4[lang]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* MAC recovery chain */}
          <section className="ganble-mac">
            <h2 className="ganble-h2"><L zh="找回 MAC 的四级降级" en="The four-step MAC fallback" /></h2>
            <ol className="ganble-mac-chain">
              {MAC_CHAIN.map((m) => (
                <li key={m.no} className="ganble-mac-step">
                  <span className="ganble-mac-no">{m.no}</span>
                  <div>
                    <h4>{m[lang].title}</h4>
                    <p>{m[lang].desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="ganble-selfheal">
              <h4><L zh="MAC 输错了怎么办：自愈" en="Wrong MAC? Self-healing" /></h4>
              <p>
                <L
                  zh="MAC 错了不会报错，只会解出越界的转动码。驱动数到连续 3 帧垃圾就触发 onKeyError，hook 忘掉这个坏 MAC（clearMac）并重新弹窗让用户输入。"
                  en="A wrong MAC doesn't throw — it just decodes out-of-range move codes. After three garbage frames in a row the driver fires onKeyError; the hook forgets the bad MAC (clearMac) and re-prompts the user."
                />
              </p>
            </div>
          </section>

          {/* On cuberoot.me */}
          <section className="ganble-usage">
            <h2 className="ganble-h2"><L zh="在 cuberoot.me 怎么用" en="How cuberoot.me uses it" /></h2>
            <p>
              <L
                zh="这三个驱动跑在 /timer 的智能魔方输入里，位置在 packages/client/app/[lang]/timer/_lib/bluetooth/。它们逐字节对齐 cstimer 的 gancube.js——一套被社区跑了多年的实现——但拆成了 gan_v2 / gan_v3 / gan_v4 三个独立 driver，由 driver.ts 定义统一契约，index.ts 里的 hook 按设备的 GATT 服务路由到对应 driver。"
                en="These three drivers run behind /timer's smart-cube input, under packages/client/app/[lang]/timer/_lib/bluetooth/. They're aligned byte-for-byte with cstimer's gancube.js — an implementation battle-tested by the community for years — but split into separate gan_v2 / gan_v3 / gan_v4 drivers behind one contract in driver.ts; the hook in index.ts routes a picked device to the right driver by its GATT service."
              />
            </p>
            <p>
              <L
                zh="解出的转动只是 WCA 记号字符串；真正的魔方状态由上层的 CubeStateTracker 从 move 流重建，所以驱动连 facelet 快照的排列/朝向数据都直接忽略。AES 是手写的纯 TS 同步实现（SBOX / 逆 SBOX / RCON / 列混合全在文件里），就为了在 BLE 回调里零延迟解帧、绝不掉帧。"
                en="A decoded turn is just a WCA-notation string; the actual cube state is re-modeled from the move stream by an upper-layer CubeStateTracker, so the drivers ignore even the permutation/orientation payload of facelet snapshots. The AES is a hand-written, synchronous pure-TS implementation (SBOX / inverse SBOX / RCON / MixColumns all in-file) so frames decrypt with zero latency inside the BLE callback and never drop."
              />
            </p>
          </section>

          <section className="ganble-links">
            <h2 className="ganble-h2"><L zh="延伸" en="Further reading" /></h2>
            <ul>
              <li><a href="https://github.com/cs0x7f/cstimer/blob/master/src/js/hardware/gancube.js" target="_blank" rel="noopener noreferrer">cstimer gancube.js — <L zh="协议参考实现" en="reference implementation" /></a></li>
              <li><a href="https://webbluetoothcg.github.io/web-bluetooth/" target="_blank" rel="noopener noreferrer">Web Bluetooth <L zh="规范" en="spec" /></a></li>
              <li><a href="https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197-upd1.pdf" target="_blank" rel="noopener noreferrer">FIPS-197 — <L zh="AES 标准" en="the AES standard" /></a></li>
              <li><a href="https://www.gancube.com/" target="_blank" rel="noopener noreferrer">GAN<L zh="（厂商）" en=" (manufacturer)" /></a></li>
            </ul>
          </section>

          <footer className="ganble-foot">
            <Link href="/code/algorithms">← <L zh="回算法" en="back to algorithms" /></Link>
            <Link href="/code">/code</Link>
          </footer>
        </div>
      </div>
    </LangCtx.Provider>
  );
}
