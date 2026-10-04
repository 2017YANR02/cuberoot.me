ALTER TABLE platform_course_revisions ADD COLUMN presentation JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(presentation)='object');
ALTER TABLE platform_certificates ADD COLUMN verification_code_encrypted BYTEA;
ALTER TABLE platform_certificates ADD COLUMN verification_key_version SMALLINT;
ALTER TABLE platform_certificates ADD CONSTRAINT platform_certificate_code_pair CHECK ((verification_code_encrypted IS NULL) = (verification_key_version IS NULL));
CREATE UNIQUE INDEX uq_platform_learning_reward_source ON platform_point_ledger(user_id,reason)
  WHERE entry_type='achievement' AND reason LIKE 'learning:%';
INSERT INTO platform_achievements(achievement_key,title_zh,title_en,description_zh,description_en,rule_snapshot,point_reward) VALUES
('first_lesson','第一课','First lesson','完成第一节课程','Complete your first lesson','{"metric":"lessons","threshold":1,"category":"learning"}',20),
('lessons_5','勤学不辍','Keep learning','累计完成五节课程','Complete five lessons','{"metric":"lessons","threshold":5,"category":"learning"}',50),
('first_review','乐于点评','First review','提交第一条课程评价','Write your first course review','{"metric":"reviews","threshold":1,"category":"community"}',20),
('streak_7','七日不辍','Seven days','连续签到七天','Check in for seven consecutive days','{"metric":"streak","threshold":7,"category":"learning"}',70),
('streak_30','月度坚持','Thirty days','连续签到三十天','Check in for thirty consecutive days','{"metric":"streak","threshold":30,"category":"learning"}',200),
('first_order','首次下单','First purchase','完成第一笔付费订单','Complete your first paid order','{"metric":"orders","threshold":1,"category":"commerce"}',30),
('first_post','首次分享','First post','发布首条通过审核的论坛内容','Publish your first approved forum post','{"metric":"posts","threshold":1,"category":"community"}',20),
('posts_10','乐于交流','Join the conversation','发布十条通过审核的论坛内容','Publish ten approved forum posts','{"metric":"posts","threshold":10,"category":"community"}',60),
('spend_1000','消费达人','Shopping milestone','人民币订单扣除已成功退款后累计消费1000元','Spend CNY 1,000 after successful refunds','{"metric":"spent_cny","threshold":1000,"category":"commerce"}',100),
('points_1000','积分达人','Points milestone','奖励结算前拥有1000积分','Have 1,000 points before this award is evaluated','{"metric":"points","threshold":1000,"category":"learning"}',100)
ON CONFLICT (achievement_key) DO NOTHING;
ALTER TABLE platform_favorites ADD COLUMN news_article_id UUID REFERENCES platform_news_articles(id) ON DELETE CASCADE;
DO $$ DECLARE constraint_row RECORD; BEGIN
  FOR constraint_row IN SELECT conname FROM pg_constraint WHERE conrelid='platform_favorites'::regclass AND contype='c'
    AND (pg_get_constraintdef(oid) LIKE '%target_type%' OR pg_get_constraintdef(oid) LIKE '%course_id%')
  LOOP EXECUTE format('ALTER TABLE platform_favorites DROP CONSTRAINT %I',constraint_row.conname); END LOOP;
END $$;
ALTER TABLE platform_favorites ADD CONSTRAINT platform_favorite_target_type CHECK(target_type IN ('course','product','event','news'));
ALTER TABLE platform_favorites ADD CONSTRAINT platform_favorite_one_target CHECK ((course_id IS NOT NULL)::int+(product_id IS NOT NULL)::int+(event_id IS NOT NULL)::int+(news_article_id IS NOT NULL)::int=1);
ALTER TABLE platform_favorites ADD CONSTRAINT platform_favorite_target_match CHECK ((target_type='course' AND course_id IS NOT NULL) OR (target_type='product' AND product_id IS NOT NULL) OR (target_type='event' AND event_id IS NOT NULL) OR (target_type='news' AND news_article_id IS NOT NULL));
CREATE UNIQUE INDEX uq_platform_favorites_news ON platform_favorites(user_id,news_article_id) WHERE news_article_id IS NOT NULL;
