/**
 * 监控套件配置 —— 移植自 Python config.json,改走 env。
 * 原 config.json 字段:tags / nr_countries / 各 poll_interval。
 */

/** 推送总开关。双跑期为 0,只吸收不发;翻 1 才真发(见 bark.ts)。 */
export const PUSH_ENABLED = process.env.MONITOR_PUSH_ENABLED === '1';

/** 纪录类型过滤(两个纪录监控共用),默认 WR/CR/NR。 */
export const RECORD_TAGS: Set<string> = new Set(
  (process.env.MONITOR_RECORD_TAGS || 'WR,CR,NR')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

/** NR 国家过滤(只推这些国家的 NR),默认 CN/US/AU/CA/PL/KR/RU。 */
export const NR_COUNTRIES: Set<string> = new Set(
  (process.env.MONITOR_NR_COUNTRIES || 'CN,US,AU,CA,PL,KR,RU')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

/** 各监控轮询间隔(ms)。原 Python 各 poll_interval 默认 30-60s,这里统一 60s。
 *  wcaComp 例外 5min:全球新比赛公示不急,且 WCA /competitions 端点在本进程内偶发慢/超时,
 *  拉长间隔降无谓负载与日志噪音(best-effort)。 */
export const POLL_INTERVAL_MS = {
  wcaLiveRecord: 60000,
  cubingRecord: 60000,
  cubingComp: 60000,
  wcaComp: 300000,
  wcaLivePr: 60000,
} as const;
