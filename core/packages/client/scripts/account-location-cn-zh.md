# Current Chinese account location options

As of review 2026-10-09, account-location-cn-current.json is the sole source of
new CN choices: 34 province-level groups and 491 options. Ordinary provinces
expose prefecture-level cities, autonomous prefectures, leagues and prefectures,
plus directly administered county-level units. Municipalities expose districts
and counties. Hong Kong has 18 districts; Taiwan has 22 cities/counties (Hsinchu
and Chiayi city/county are distinct). Macao has no lower administrative level in
this contract; do not invent cities from statistical or historic parishes.

The mainland baseline is the archived MCA 2025-12-31 hierarchy (333 prefecture
units), with Caohu added from the 2026-04-17 Xinjiang government announcement.
Cenling remains under Kashgar, not a province-direct choice. Chongqing's 37 units
include Liangjiang and exclude Jiangbei/Yubei. Sources, archive commit and SHA-256
are recorded in the JSON. The official MCA host refused connections during this
review, so the baseline was obtained from a pinned archive, not a live official
fetch. This is not a guarantee against unpublished changes. Do not advance the
review date without checking sources.

English saved identifiers are retained for matching entities where possible.
New values distinguish ambiguous city/county or autonomous-prefecture entities.
account-location-cn-zh.json is now ONLY a historical saved-value label source,
exported as legacyCityNamesZh, never used for new choices. The UI explicitly marks
out-of-list saved values and never silently migrates them. No database rewrite
or eligibility-rule change is part of this update. Other countries are unchanged.

Maintenance: update the reviewed source using official evidence, run the existing
build/check commands, review the full generated diff, and update per-group count
and semantic fixtures for real source changes. Bump the account resource version.
The build fails on missing labels, duplicates or mismatched administrative parents.

## Historical translation audit (superseded as an option contract)

# Chinese account location labels

`account-location-cn-zh.json` is the display-label source for the existing
`@countrystatecity/countries` CN options, keyed by province code and the exact
upstream city name. The English identifiers remain unchanged in saved profiles.
Do not flatten these keys: homographs such as Suzhou have different Chinese names.

The labels use the National Bureau of Statistics administrative names distributed
by [Administrative-divisions-of-China](https://github.com/modood/Administrative-divisions-of-China)
(`dist/pcas-code.json`, retrieved 2026-10-05), selected within the source province.
County-level names take precedence over same-sounding town seats; autonomous
county names also match their short forms. The existing `localizeCity` dictionary
is reused where applicable, with province-level homographs checked separately.
[GeoNames CN data](https://download.geonames.org/export/dump/CN.zip)
([CC BY 4.0](https://www.geonames.org/about.html)) supplies additional town names.
GeoNames' first Chinese alternate name is **not** authoritative: it can be a seat,
old name, Japanese spelling or homophone. Pinyin comparisons only flag discrepancies;
they cannot establish the correct Chinese characters.

The source includes older
upstream names; this is a translation layer, not a claim that the upstream list
represents current administrative boundaries. In particular the upstream Taiwan
group contains mainland cities, Fujian's Jijiang has Chongqing coordinates, and
some entries have missing coordinates; their
identifiers and grouping are preserved here.

Edit this source when upstream options change, then run `pnpm build:account-locations`
in `core/packages/client` (or the filtered command from `core`). The builder fails
on any missing CN label. `pnpm check:account-locations` checks both generated
options and labels; never edit `public/account-locations/CN.json` directly.

2026-10-05 audit covered all 3,839 unique upstream options in 34 groups. It
compared province-scoped administrative names and the existing localization
dictionary, then reviewed remaining romanizations, townships and historical
names against source coordinates and official records. The initial GeoNames
candidate set was rejected because it substituted seats, homophones and historical
names. Pinyin comparisons were used to identify discrepancies, not as proof of
correct characters or identity. Regression fixtures cover these specific errors.

Additional source checks:

- 重庆 Zhong is 忠县: [忠县政府基本县情](https://www.zhongxian.gov.cn/zxfz/). Preserve the suffix in this two-character name; stripping 县 leaves an invalid single-character display label. A full scan of all 3,839 labels found this was the only single-character label.
- 天津汊百户: [武清统计公报](https://www.tjwq.gov.cn/zwgk/zfxxgk/wbj2/qtjj1/fdzdgknr27/tjxx27/202406/W020241231519677306689.pdf).
- 天津拾棉庄: [天津文旅](https://whly.tj.gov.cn/tjswlzxw/jgbn/whtj/whfy/202411/t20241109_6775557.html).
- 天津蒙酄: [蓟州官方环评](https://www.tjjz.gov.cn/zwgk/zfxxgkqjjg/zwfwb1/fdzdgknr9/xzxkfwsx9/202503/W020250331567019681751.pdf); coordinates refer to the 下仓 locality, not 孟圈 in 汉沽.
- 天津蛏头沽、蔡家堡: [司法部自然保护区条例及对应坐标](https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzdfzwgz/200504/t20050428_135379.html). 糙甸: [宝坻区补贴村表](https://www.tjbd.gov.cn/zwgk/zfxxgkjz/ltkz/fdzdgknr41/nyncfz41/snbt41/202505/t20250509_6927560.html). 柳子口: [天津发改委电网名单](https://fzgg.tj.gov.cn/xxfb/tzggx/202408/W020240820640861633878.pdf).
- 福建路下、赤溪、崇儒、盐田: [福建官方行政区划表](https://mzt.fujian.gov.cn/gk/tzgg/202601/t20260105_7071220.htm).
- 贵州清浪: [地名库坐标记录](https://www.fallingrain.com/world/CH/18/Qinglang2.html), [铜仁官方历史地名对应](https://szb.tongren.gov.cn/trrb/content/202603/13/content_74188.html). 隆里所: [锦屏政府公报](https://www.jinping.gov.cn/zwgk/zfgb/qk/2023/202310/P020231025515494082267.pdf). 良村场: [四渡赤水纪念馆](https://www.sdcs1935.com/html/yanjiu/sdcsyz/201801/856af6517dae9727.shtml).
- 广东 Dongbu/Nanbu/Zhongxin denote 东部/南部/中心片区, not similarly spelled villages; [upstream administrative grouping](https://en.wikipedia.org/wiki/List_of_administrative_divisions_of_Guangdong), [中山政府片区规划](https://www.zs.gov.cn/zwgk/fggw/sfbwj/content/post_270519.html). Their supplied coordinates can be incorrect or zero.
- 湖南 Gangdong has the GeoNames alias Jiangdong and corresponds to 江东 in 溆浦: [溆浦政府](https://www.xp.gov.cn/xp/c110417/202412/79b961836db54cddbfb7b4224a0dbea3.shtml). Bojia retains 柏家: [祁阳官方旅游规划](https://www.qy.gov.cn/qy/lyly/202309/fde5a09995de4cf895abf2171a5153d7/files/80e6b384fdbd4a71a91fcc4f1d797ff2.pdf).
- 贵州尤鱼铺: [铜仁政府交通报道](https://www.tongren.gov.cn/2022/0726/281676.shtml).
- 山东清洋: [烟台政府](https://www.yantai.gov.cn/art/2025/2/12/art_11799_3237681.html).
- 福建闽安: [福州官方中英地名](https://fzwb.fuzhou.gov.cn/zwgk/zcwj/202407/P020250106539938522698.pdf).
- 新疆和安、和康: [自治区人社厅公告](https://rst.xinjiang.gov.cn/xjrst/c112746/202511/47cc669cba6747d69a046ecda20d05e8.shtml).
- 新疆藏桂: [自治区财政厅](https://czt.xinjiang.gov.cn/xjczt/c115025/202512/c6c5a02670fd457cb9f6036019ad8785.shtml).
- 西蒙 / Simong: [中国人民大学清史研究所](https://iqh.ruc.edu.cn/old/qdzwgxyj/zwgx_yjqy/js/601d9fe56bd94100a54e8107b145bcd6.htm); upstream supplies zero coordinates, which are not used to infer a different location.
- Tanbei is an upstream historical alias of 沁阳: [Getty TGN identity and coordinates](https://www.getty.edu/vow/TGNFullDisplay?english=Y&find=&nation=&place=&subjectid=1071122), [沁阳政府](https://www.qinyang.gov.cn/2026/05-06/602569.html). The suspicious variant 覃杯 is not used as the modern city label.

## Shanghai current district options (reviewed 2026-10-09)

Shanghai is an exception to the upstream-preservation rule above: the SH keys in
`account-location-cn-zh.json` define its complete current 16-district option list.
Verified against the [Shanghai Civil Affairs Bureau district table, published 2026-01-05](https://mzj.sh.gov.cn/MZ_zhuzhan1539_0-2-8-1459/20250701/13c356554a0a4634b311b7aeb10d1918.html).
Remove obsolete Zhabei and lower-level Zhujiajiao (a town within Qingpu) from new
choices. Keep the existing English identifiers for the 16 retained districts.
Historical saved profile values are not migrated by this data build. Other
province lists still follow upstream and are not certified current by this review.
