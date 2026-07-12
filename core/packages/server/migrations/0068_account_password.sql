-- 0068_account_password.sql — 给内部账号加「可选密码」(邮箱 + 密码登录)。
--
-- 背景:此前邮箱账号只能验证码登录(每次发码)。加一份可选密码,让用户设一次后即可
--       邮箱 + 密码直接登录,不再每次收码。密码属于账号(app_users)而非某条身份 ——
--       一个账号一份密码,登录时按 email 身份找到账号再验密码。密码是可选的:WCA /
--       Google / 三方账号可以一直不设(它们各有各的登录方式)。
-- 安全:只存 scrypt 派生值(utils/account.ts hashPassword,自带 16B 随机盐 + 参数,自描述串),
--       明文永不落库。设/改密走登录态(先用验证码或第三方登录一次),邮箱天然经过验证。
--
-- Runner (ops/bin/apply_migrations.sh) 每文件独立 BEGIN/COMMIT + ON_ERROR_STOP=1 —— 禁写 BEGIN;/COMMIT;。
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash       TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;
