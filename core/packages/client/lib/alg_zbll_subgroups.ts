/**
 * ZBLL 子组 slug 的方向制别名(配合 server migration 0081)。
 *
 * DB 里子组 slug 从数字制(U1..U6)改成方向制(UR/UL/UB/UF/UD/UU 等,取自各子组 case 的
 * ollcp 前缀方向)。旧的数字 URL(/zbll/u1、/zbll/pi%201、/zbll/as1 …)靠这张表继续兼容,
 * 老链接 / 书签不失效 —— 规范用新 slug,旧的只作入口别名。
 *
 * 表由迁移前的线上数据逐组提取(每个顶层组 6 个方向,H 组高对称只有 4 个),方向组内唯一。
 */
const ZBLL_SUBGROUP_ALIAS: Record<string, string> = {
  u1: 'ur', u2: 'ul', u3: 'ub', u4: 'uf', u5: 'ud', u6: 'uu',
  t1: 'tr', t2: 'tl', t3: 'tb', t4: 'tf', t5: 'td', t6: 'tu',
  l1: 'll', l2: 'lr', l3: 'lf', l4: 'lb', l5: 'ld', l6: 'lu',
  h1: 'hb', h2: 'hl', h3: 'hd', h4: 'hu',
  s1: 'sb', s2: 'sf', s3: 'sl', s4: 'sr', s5: 'sd', s6: 'su',
  as1: 'asf', as2: 'asb', as3: 'asr', as4: 'asl', as5: 'asd', as6: 'asu',
  // Pi 组旧 slug 第二段带空格('Pi 1');URL decode 后是 'pi 1',也收手打的 'pi1'
  'pi 1': 'pif', pi1: 'pif', 'pi 2': 'pib', pi2: 'pib', 'pi 3': 'pir', pi3: 'pir',
  'pi 4': 'pil', pi4: 'pil', 'pi 5': 'pid', pi5: 'pid', 'pi 6': 'piu', pi6: 'piu',
};

/**
 * 旧数字制子组 slug → 新方向制;非 zbll、或已经是新 slug / 顶层组 slug,原样返回。
 * URL 落地时用它把老链接引到新组,下游匹配逻辑只需认 canonical(新 slug)。
 */
export function canonicalZbllSubgroupSlug(set: string, slug: string | null): string | null {
  if (set !== 'zbll' || !slug) return slug;
  return ZBLL_SUBGROUP_ALIAS[slug.trim().toLowerCase()] ?? slug;
}
