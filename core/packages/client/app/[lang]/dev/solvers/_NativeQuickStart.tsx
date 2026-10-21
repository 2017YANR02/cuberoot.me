'use client';

import { useState } from 'react';
import { Check, Copy, Terminal } from '@app-foundation/icons/lucide';
import { useCopy } from '@/hooks/useCopy';
import { useT } from '@/hooks/useT';

const tiers = ['32M', '128M', '256M', '512M', '1G', '2G', '4G', '8G', '16G'];
const executable = './target/init-cli/release/cube48opt-research';

export default function NativeQuickStart() {
  const t = useT();
  const [variant, setVariant] = useState(6);
  const { copy, copied } = useCopy();
  const commands = `git clone https://github.com/2017YANR02/cuberoot.me.git
cd cuberoot.me/solver/experiments/cube48opt-rust
cargo build --release --target-dir target/init-cli
${executable} init --memory ${tiers[variant - 1]}`;
  const table = variant === 1 ? 'h48prun01.dat' : `h48prun31h${variant}.dat`;
  const solve = `CUBEOPT_VARIANT=${variant} ${executable} solve \\
  ../../tables/cubeopt/opt${variant}/small-memory.bin \\
  ../../tables/cubeopt/opt${variant}/${table} 8 20 0`;

  return <section className="solv-section solv-start" id="native-init" aria-labelledby="native-init-title">
    <header className="solv-sec-head">
      <Terminal size={16} aria-hidden="true" />
      <h2 id="native-init-title">{t('原生版：选档建表', 'Native solver: build your tables')}</h2>
    </header>
    <ol className="solv-start-steps">
      <li>
        <h3>{t('打开电脑上的终端', 'Open a terminal on your computer')}</h3>
        <p>{t('先安装 Git、Rust 和 Node.js 24 或更新版本。建表在你的电脑上运行，无需启动网站。', 'Install Git, Rust and Node.js 24 or later. Tables are generated on your computer; the website does not need to run.')}{' '}
          <a href="https://rustup.rs/" target="_blank" rel="noreferrer">{t('安装 Rust', 'Install Rust')}</a>{' · '}
          <a href="https://nodejs.org/en/download" target="_blank" rel="noreferrer">{t('安装 Node.js', 'Install Node.js')}</a>
        </p>
      </li>
      <li>
        <h3>{t('选择档位，执行命令', 'Choose a size and run the commands')}</h3>
        <div className="solv-start-controls">
          <label>{t('表档位', 'Table size')}{' '}
            <select className="solv-start-tier" value={variant} onChange={event => setVariant(Number(event.target.value))}>
              {tiers.map((tier, index) => <option key={tier} value={index + 1}>Opt{index + 1} · {tier}</option>)}
            </select>
          </label>
          <button type="button" className="solv-start-copy" onClick={() => copy(commands)}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? t('已复制', 'Copied') : t('复制命令', 'Copy commands')}
          </button>
        </div>
        <pre tabIndex={0} aria-label={t('下载、编译和建表命令', 'Clone, build and initialize commands')}><code>{commands}</code></pre>
        <p>{t('已有仓库可跳过 git clone，进入对应目录执行。编译只需一次，之后只运行最后一行；终端会显示建表进度。', 'If you already have the repository, skip git clone and enter its solver directory. Build once; later, run only the last line. Generation progress appears in the terminal.')}</p>
        <p>{t('档位表示表容量，运行还需要额外内存。此入口支持 Opt1–9，32G Opt10 仍使用独立流程。', 'The size describes the table; execution needs additional memory. This entry supports Opt1–9. The 32G Opt10 version has a separate workflow.')}</p>
      </li>
      <li>
        <h3>{t('保存结果，下次直接复用', 'Keep the files for the next run')}</h3>
        <p>{t('生成结果位于仓库内：', 'Files are saved inside the repository:')}{' '}<code>solver/tables/cubeopt/opt{variant}/</code></p>
        <p>{t('再次执行同一条建表命令会校验并复用完整表。换电脑时复制整个目录，包括 .dat、small-memory.bin 和两份 JSON 文件。', 'Running the same initialization command again verifies and reuses complete tables. To move to another computer, copy the whole directory, including the .dat, small-memory.bin and both JSON files.')}</p>
        <details>
          <summary>{t('Linux：建表后的求解示例', 'Linux: solve after initialization')}</summary>
          <p>{t('仍在上面的求解器目录执行，随后按“标识、Tab、打乱”输入，每行一条。', 'Run from the same solver directory, then enter an ID, a Tab and a scramble, one per line.')}</p>
          <pre tabIndex={0} aria-label={t('Linux 求解命令', 'Linux solve command')}><code>{solve}</code></pre>
        </details>
      </li>
    </ol>
    <p>{t('macOS 建表会自动经过资源守卫；资源不足或已有保护停止记录时会明确报错。', 'On macOS, initialization runs through the resource guard and reports insufficient resources or an existing protection stop.')}{' '}
      <a href="https://github.com/2017YANR02/cuberoot.me/blob/main/solver/experiments/cube48opt-rust/README.md" target="_blank" rel="noreferrer">{t('完整说明', 'Full instructions')}</a>
    </p>
  </section>;
}
