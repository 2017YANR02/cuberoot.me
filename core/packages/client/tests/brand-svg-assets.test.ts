// 品牌 SVG(public/icons/CubeRoot-{lockup,mark}[-dark].svg)的形状守卫。
//
// 这几份是从 Illustrator 导出的稿子加工来的:里面原本有两段 <text>,用的是 SimSun-ExtB
// 和文悦汇墨手书(商业字体)。**必须已经转成路径** —— 留着 <text> 的话别人机器上会掉回
// 系统字体,PDF 里更是直接糊掉,而且两处都不报错,只是字变了样,最难发现。
// 重新导出 logo 时若忘了转曲 / 忘了内联 CSS,这里直接红。
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const FILES = ['CubeRoot-lockup.svg', 'CubeRoot-mark.svg', 'CubeRoot-lockup-dark.svg', 'CubeRoot-mark-dark.svg'];

/** 只看真正的标记 —— 文件头那条来历注释里就写着 `<text>`,不剥掉会自己把自己判红。 */
const read = (f: string) => readFileSync(join(ICONS, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '');

describe('CubeRoot brand SVG assets', () => {
  for (const f of FILES) {
    const svg = read(f);

    it(`${f}: 文字已转曲、CSS 已内联`, () => {
      expect(svg).not.toMatch(/<text/);
      expect(svg).not.toMatch(/font-family/);
      // svg2pdf 不解析 <style> 里的 class 选择器,颜色必须是表现属性
      expect(svg).not.toMatch(/<style/);
      expect(svg).not.toMatch(/class=/);
      expect(svg).toMatch(/fill="#/);
    });

    it(`${f}: viewBox 可用(PDF 按它算宽高比)`, () => {
      const vb = /viewBox="([\d.\-\s]+)"/.exec(svg);
      expect(vb).not.toBeNull();
      const n = vb![1].trim().split(/\s+/).map(Number);
      expect(n).toHaveLength(4);
      expect(n[2]).toBeGreaterThan(0);
      expect(n[3]).toBeGreaterThan(0);
    });
  }

  it('深色版是白墨,浅色版是深墨 —— 拿反了就是一页白底白字', () => {
    for (const f of FILES) {
      const svg = read(f);
      const ink = f.includes('-dark') ? /fill="#fff"/ : /fill="#3f3f3f"/;
      expect(svg, f).toMatch(ink);
    }
  });

  // 主屏图标(iOS「添加到主屏幕」)。之前根本没发 apple-touch-icon,Safari 就截了张页面
  // 缩略图当图标 —— 用户看到的是一张网页截图,不是 logo。两条都得守:link 在,PNG 不透明
  // (iOS 会把 alpha 合成到黑底)。重生成走 scripts/gen-app-icons.mjs。
  describe('主屏 / PWA 图标', () => {
    /** PNG IHDR:宽、高、colorType(4 和 6 带 alpha)。 */
    const ihdr = (f: string) => {
      const b = readFileSync(join(ICONS, f));
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] };
    };

    for (const [f, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]] as const) {
      it(`${f}: ${size}² 且不透明`, () => {
        const { w, h, colorType } = ihdr(f);
        expect([w, h]).toEqual([size, size]);
        expect(colorType, 'iOS 把 alpha 合成到黑底 —— 必须 flatten 成不透明').not.toBe(6);
        expect(colorType).not.toBe(4);
      });
    }

    it('root layout 发了 apple-touch-icon + manifest,主屏名字不取长标题', () => {
      const layout = readFileSync(join(ICONS, '..', '..', 'app', 'layout.tsx'), 'utf8');
      expect(layout).toMatch(/rel="apple-touch-icon"[^>]*href="\/icons\/apple-touch-icon\.png"/);
      expect(layout).toMatch(/rel="manifest"/);
      expect(layout).toMatch(/name="apple-mobile-web-app-title"/);
    });

    it('manifest 里引到的图标都真的在盘上', () => {
      const m = JSON.parse(readFileSync(join(ICONS, '..', 'manifest.json'), 'utf8'));
      expect(m.icons.length).toBeGreaterThan(0);
      for (const i of m.icons) expect(existsSync(join(ICONS, '..', i.src)), i.src).toBe(true);
      expect(m.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
    });
  });

  it('标记版比整组扁 —— 页眉那 9pt 高的位置放整组就是一团糊', () => {
    const ratio = (f: string) => {
      const n = /viewBox="([\d.\-\s]+)"/.exec(read(f))![1].trim().split(/\s+/).map(Number);
      return n[2] / n[3];
    };
    expect(ratio('CubeRoot-mark.svg')).toBeGreaterThan(ratio('CubeRoot-lockup.svg'));
  });
});
