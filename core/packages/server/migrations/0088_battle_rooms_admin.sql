-- /timer 联机对战:房主(管理员)+「同时开始计时」房设。
--
-- admin      建房者 pid = 首任房主;可转让,可踢人。房主离场后由「最早加入者」自动接任
--            (服务端读时回落,不写库,免竞态)。
-- sync_start 房主开关:开启后本轮所有「在线且未交卷」的玩家都点过准备,服务端才落一个
--            start_at(服务器毫秒,now + 3s),各端按时钟偏移换算到本机同时起表。
-- start_at   本轮同时起表时刻;开下一轮 / 关掉 sync_start 即清空。
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS admin      VARCHAR(16);
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS sync_start BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS start_at   BIGINT;
