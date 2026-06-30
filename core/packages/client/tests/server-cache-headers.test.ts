// API 缓存头分层守卫:服务端「可变数据」端点禁止给浏览器发长缓存。
// 规则:Cache-Control 里 max-age(浏览器层)> 600s 的行,所在文件必须在 IMMUTABLE_ALLOWLIST
//(数据天然不可变:已结束比赛 / 确定性计算 / immutable 资源)。
//
// 为什么:日更/周更重灌的数据(wca_stats_extra / historical_ranks 一族)如果浏览器层 max-age=86400,
// 任何暂态响应(重灌窗口、口径列未填充的 null、旧 shape)会被用户浏览器按 URL 钉 24h —— nginx purge、
// 站点「清除数据」都够不到 HTTP 缓存,只能等过期(2026-06-10 实际踩到:选手页 SOR 全 null 钉一天)。
// 正确写法:`max-age=300, s-maxage=86400`(nginx 1.26 认 s-maxage,共享层保持 24h,stats.yml 重灌后全清);
// 空/暂态 payload 发 `no-store`;改响应 shape 必须 bump URL `v=` 参数。
//
// CI 跑 vitest(server 包无测试集),故跨包扫源码当红灯;新端点想长缓存 → 进 allowlist 留下 review 信号。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'server', 'src', 'routes');
// 1h 内的浏览器缓存自愈快,允许;> 1h(实务上就是 86400 一族)才是「钉死一天」事故类
const BROWSER_MAX_AGE_LIMIT = 3600;

// 文件级豁免:数据天然不可变,浏览器长缓存是刻意设计
const IMMUTABLE_ALLOWLIST = new Set([
  'article.ts',       // 文章图片 bytea immutable + 阅读页 5min
  'feedback.ts',      // 反馈媒体(/feedback/media/:id)上传即不可变,同 article 图片 bytea
  'wca_scrambles.ts', // 已结束比赛的官方打乱,永不变
  'wca_schedule.ts',  // 已结束比赛的赛程,永不变(进行中已是 3600)
  'recon.ts',         // cubing.com 整轮完整成绩(complete = 全填,不再变)
  'nemesizer.ts',     // 启动时载入内存的静态 .bin.gz 数据集
  'cubing_live.ts',   // wca_db 源(已结束比赛)immutable;实时源已是 30s
  'cube.ts',          // 确定性求解结果(同输入恒同输出)
]);

describe('server cache headers — mutable data must not pin browsers', () => {
  const files = readdirSync(ROUTES_DIR).filter(f => f.endsWith('.ts'));

  it('scans a meaningful number of route files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('Cache-Control max-age > 600 only in immutable-data allowlist files', () => {
    const violations: string[] = [];
    for (const f of files) {
      if (IMMUTABLE_ALLOWLIST.has(f)) continue;
      const lines = readFileSync(join(ROUTES_DIR, f), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!line.includes('Cache-Control')) return;
        // (?<!s-) 排除 s-maxage(共享层不限);matchAll 扫同行多值(ternary 两分支)
        for (const m of line.matchAll(/(?<!s-)max-age=(\d+)/g)) {
          if (parseInt(m[1]!, 10) > BROWSER_MAX_AGE_LIMIT) {
            violations.push(`${f}:${i + 1}  ${line.trim()}`);
            break;
          }
        }
      });
    }
    expect(
      violations,
      `可变数据端点禁止浏览器长缓存(踩过:坏响应被钉 24h,purge 无效)。` +
      `改成 'max-age=300, s-maxage=86400'(nginx 层仍 24h);确属不可变数据才加进 IMMUTABLE_ALLOWLIST。\n` +
      violations.join('\n'),
    ).toEqual([]);
  });
});
