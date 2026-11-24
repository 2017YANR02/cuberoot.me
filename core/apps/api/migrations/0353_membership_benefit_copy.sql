-- Refresh only known copy. Keep custom items, order and subsequent administrator edits.
WITH copy_edits(id, old_zh, old_en, new_zh, new_en) AS (VALUES
  ('unlimited_333_cloud_optimal', '不限量三阶魔方云端最少步快速求解', 'Unlimited cloud-based 3×3 optimal solving', '不限次数使用三阶云端最少步求解', 'Unlimited cloud-based 3×3 optimal solves'),
  ('expert_recon_10_monthly', '获取高手的解法复盘（每月 10 把）', 'Expert solve reconstructions (10 per month)', '每月获取 10 把高手解法复盘', 'Get 10 expert solve reconstructions per month'),
  ('badge', '专属会员徽章', 'Exclusive member badge', '展示 Pro 徽章，可在致谢名单署名', 'Display a Pro badge and opt in to the supporters list'),
  ('early', '新功能抢先体验', 'Early access to new features', NULL, NULL),
  ('thanks', '致谢名单署名', 'Listed in the acknowledgments', NULL, NULL),
  ('platform_follow', '获得魔方根在各平台的关注', 'Get followed by CubeRoot across platforms', '可联系魔方根关注你的社交账号', 'Request a follow from CubeRoot on social media'),
  ('vip_group', '进入魔方根 VIP 群', 'Join the CubeRoot VIP group', '加入魔方根会员群，可在群内分享二维码', 'Join the CubeRoot member group and share QR codes there'),
  ('group_qr_sharing', '允许在魔方根群分享二维码', 'Share QR codes in CubeRoot groups', NULL, NULL),
  ('custom_sim_logo', '在魔方模拟器中使用自定义 logo', 'Use a custom logo in the cube simulator', '在模拟器中使用自己的 Logo', 'Use your own logo in the simulator'),
  ('personal_video_review_2_monthly', '每月可发送 2 把视频给我进行复盘（仅限三阶、二阶、SQ1、金字塔和斜转）', 'Send me up to 2 solve videos per month for review (3×3, 2×2, SQ1, Pyraminx, and Skewb only)', '每月提交 2 把个人视频供人工复盘，支持三阶、二阶、SQ1、金字塔和斜转', 'Submit 2 solve videos per month for personal review: 3×3, 2×2, Square-1, Pyraminx or Skewb'),
  ('teacher_student_profile_ranking', '老师主页展示学生，学生主页展示老师，排名页展示老师', 'Show students on teacher profiles, teachers on student profiles, and teachers in rankings', '在个人主页展示师生关系，在排名页展示老师', 'Show teacher–student links on profiles and teachers in rankings'),
  ('enterprise_profile', '企业专属介绍页面', 'Dedicated enterprise profile page', '展示企业介绍页', 'Publish a business profile'),
  ('enterprise_content_storage_custom_course', '教程、图文资料和视频等云端存储，以及企业课程方案定制', 'Cloud storage for tutorials, articles, images, and videos, plus customized enterprise course plans', '存储教学图文和视频，可联系定制企业课程方案', 'Store teaching materials and videos, and request a custom course plan'),
  ('custom_5e9aa3b364634ef18986b545a4cb089b', '使用训练器的高级功能', '', NULL, NULL),
  ('custom_d9a1bd9a17f4424b8fa9b6c7d71e13a8', '最新资讯，魔方圈内幕', '', NULL, NULL),
  ('vip_group', '加入魔方根会员群', '', '加入魔方根会员群，可在群内分享二维码', 'Join the CubeRoot member group and share QR codes there'),
  ('group_qr_sharing', '在魔方根群分享二维码', '', NULL, NULL),
  ('custom_68daa6649243469daad34d64891cce73', '更多的 AI聊天额度', '', NULL, NULL),
  ('custom_ed32bcc401a04b218e21d18cdd564a83', '上传视频到本网站', '', '上传复盘视频和图库照片，上传、管理和下载音乐', 'Upload solve videos and gallery photos, and upload, manage and download music'),
  ('custom_9e2c10c0b8194dd39ef8b854ecffab50', '可以将本网站的内容发布到自己的网站或平台上', '', '可在自己的网站或平台转载本站内容', 'Republish site content on your website or platform')
), entries AS (
  SELECT b.revision, item, pos, e.*
  FROM membership_benefits b CROSS JOIN LATERAL jsonb_array_elements(b.items) WITH ORDINALITY AS src(item, pos)
  LEFT JOIN copy_edits e ON (item->>'id', item->>'zh', item->>'en') = (e.id, e.old_zh, e.old_en)
  WHERE b.id = 1
), eligible AS (
  SELECT *, CASE
    WHEN id IN ('badge','thanks') THEN (SELECT count(*) = 2 FROM entries WHERE id IN ('badge','thanks'))
    WHEN id IN ('vip_group','group_qr_sharing') THEN (SELECT count(*) = 2 FROM entries WHERE id IN ('vip_group','group_qr_sharing'))
    ELSE id IS NOT NULL END AS apply_edit
  FROM entries
), revised AS (
  SELECT revision, jsonb_agg(CASE WHEN apply_edit THEN item || jsonb_build_object('zh',new_zh,'en',new_en)
                                 ELSE item END ORDER BY pos)
                   FILTER (WHERE NOT apply_edit OR new_zh IS NOT NULL) AS items
  FROM eligible GROUP BY revision
)
UPDATE membership_benefits b SET items = r.items, revision = b.revision + 1, updated_at = now()
FROM revised r WHERE b.id = 1 AND b.revision = r.revision AND b.items IS DISTINCT FROM r.items;
