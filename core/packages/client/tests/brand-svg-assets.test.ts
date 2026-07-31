// 品牌 SVG(public/icons/CubeRoot-{lockup,mark}[-dark].svg)的形状守卫。
//
// 这几份是从 Illustrator 导出的稿子加工来的:里面原本有两段 <text>,用的是 SimSun-ExtB
// 和文悦汇墨手书(商业字体)。**必须已经转成路径** —— 留着 <text> 的话别人机器上会掉回
// 系统字体,PDF 里更是直接糊掉,而且两处都不报错,只是字变了样,最难发现。
// 重新导出 logo 时若忘了转曲 / 忘了内联 CSS,这里直接红。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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

  it('标记版比整组扁 —— 页眉那 9pt 高的位置放整组就是一团糊', () => {
    const ratio = (f: string) => {
      const n = /viewBox="([\d.\-\s]+)"/.exec(read(f))![1].trim().split(/\s+/).map(Number);
      return n[2] / n[3];
    };
    expect(ratio('CubeRoot-mark.svg')).toBeGreaterThan(ratio('CubeRoot-lockup.svg'));
  });
});
