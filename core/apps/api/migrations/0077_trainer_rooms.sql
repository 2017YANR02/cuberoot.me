-- 公式训练器「协同房间」(在线多设备复习分工):房间持有共享的 case 队列 + 领取游标,
-- 多台设备各自「领取下一题」时原子出队 —— 保证不重不漏、动态均衡、支持乱序(队列由服务端洗)。
-- 无需登录:房间码即身份(5 位无歧义字符)。round 递增 = 一轮刷完开新一轮(乱序则队列重洗)。
-- keys/queue 存 case_key(客户端 trainer 全链路的 `subgroup|name`),不 FK alg_cases。
CREATE TABLE trainer_rooms (
  code        VARCHAR(12)  PRIMARY KEY,
  puzzle      VARCHAR(16)  NOT NULL,
  set_slug    VARCHAR(48)  NOT NULL,
  order_mode  VARCHAR(8)   NOT NULL DEFAULT 'shuffle' CHECK (order_mode IN ('seq', 'shuffle')),
  keys        JSONB        NOT NULL,           -- 规范序的 case_key 全集(池)
  round       INT          NOT NULL DEFAULT 1,
  queue       JSONB        NOT NULL,           -- 当前轮的有序 case_key 队列
  next_index  INT          NOT NULL DEFAULT 0, -- 已领取游标(= 已发放数);>= total 即本轮领完
  total       INT          NOT NULL,           -- queue 长度
  created_at  BIGINT       NOT NULL,
  updated_at  BIGINT       NOT NULL
);
-- 惰性清理过期房间(创建时 DELETE updated_at < now-24h)靠这个索引扫。
CREATE INDEX idx_trainer_rooms_updated ON trainer_rooms(updated_at);
