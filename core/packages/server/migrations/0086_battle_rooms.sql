-- /timer 联机对战房间(多设备,各自设备计时):房间持有「当前轮各项目的打乱」+ 玩家表
-- (名字/在线心跳/实时状态/所选项目)+ 当前轮成绩 + 每轮战绩历史 + 累计胜场。无需登录:
-- 房间码即房间身份,随机 playerId 即玩家身份。实时性靠客户端 1s 轮询 GET(no-store)+
-- 单行 jsonb 原子合并。
--
-- 项目模型:每人可选自己的项目(默认 = 建房项目)。**同项目玩家共享同一条打乱**(公平),
-- 不同项目各持一条,存 scrambles={event:scramble}。谁先需要某项目的打乱谁 lazy 生成并
-- set-if-absent 填进去。胜负按「同项目分组」判,各组最快各计一胜(仅 ≥2 人的组计分)。
--
-- round 递增 = 任一玩家开下一轮(CAS,只第一个成功),开轮时服务端结算上一轮各组胜者进
-- scores、把该轮 {各项目打乱, 各人项目快照, 各方成绩, 胜者} 压进 history(供战绩面板 +
-- single/ao5/moX 统计),history 只留最近 50 轮防 jsonb 无界膨胀。
CREATE TABLE battle_rooms (
  code        VARCHAR(12)  PRIMARY KEY,
  event       VARCHAR(16)  NOT NULL,             -- 房间默认项目(新加入者的默认;timer EventId)
  round       INT          NOT NULL DEFAULT 1,
  scrambles   JSONB        NOT NULL DEFAULT '{}'::jsonb, -- 当前轮各项目打乱 {event:scramble}(同项目共享)
  players     JSONB        NOT NULL DEFAULT '{}'::jsonb, -- {pid:{name,joined,seen,ph,at,event}}
  results     JSONB        NOT NULL DEFAULT '{}'::jsonb, -- 当前轮成绩 {round:{pid:{t,p}}}
  history     JSONB        NOT NULL DEFAULT '[]'::jsonb, -- 已结束各轮 [{round,scrambles,playerEvents,results,winners}](最近 50)
  scores      JSONB        NOT NULL DEFAULT '{}'::jsonb, -- {pid: 胜场数}
  created_at  BIGINT       NOT NULL,
  updated_at  BIGINT       NOT NULL
);
-- 惰性清理过期房间(创建时 DELETE updated_at < now-24h)靠这个索引扫。
CREATE INDEX idx_battle_rooms_updated ON battle_rooms(updated_at);
