# 金茂大厦 Blender 精修依据

2026-09-08。编辑源为 `design/space/scenes/shanghai.blend` 中的 `Jin Mao Tower`，网页对象 ID 保留 `root/132/0`。其他建筑及动态绑定保持原样。

## 实拍与尺寸依据

| 来源 | 已检查内容 | 采用范围 |
| --- | --- | --- |
| [幕墙承建方 Permasteelisa](https://www.permasteelisagroup.com/historic-project/jin-mao-tower/) | 420.5 米、88 层、铝翼片、不锈钢空心构件和铝板退台；三张俯拍、塔冠、幕墙细部实拍 | 总高、材质类别、横竖构件的层次；宽度和细部尺寸仍按照片估算 |
| [SOM 建筑师](https://www.som.com/projects/jin-mao-tower/) | 署名 Tim Griffith 的日景及夜景照片 | 银灰色幕墙、分段轮廓、竖向亮线和较亮塔冠；不是现场配光数据 |
| [摩天楼博物馆](https://old.skyscraper.org/EXHIBITIONS/BIG_BUILDINGS/CONTENT/jumbos/j_27.htm) | 引述 SOM 的 88 层分段规则 | 延续 `[16,14,12,10,8,7,6,5,4,3,2,1]` 楼层分段 |

承建方的原图：[俯拍](https://www.permasteelisagroup.com/wp-content/uploads/2025/07/Jin-Mao-Tower-Shanghai1.jpg)、[塔冠近景](https://www.permasteelisagroup.com/wp-content/uploads/2025/07/Jin-Mao-Tower-Shanghai2.jpg)、[幕墙细部](https://www.permasteelisagroup.com/wp-content/uploads/2025/07/Jin-Mao-Tower-Shanghai3.jpg)。仅作本地实拍对照，不随网页分发，不用照片包裹建筑。照片拍摄日期未确认，不能据此保证所有现状细节。

## 本轮建模范围

- 保留 420.5 米总高、88 层分段和现有地理位置；4.04 米统一层高及平面宽度沿用估算，不能称为施工图精度。
- 每段独立可编辑，补充中央与斜角幕墙的竖向构件、每层双横杆、檐口暗缝及退台上方细杆。
- 塔冠补充密集的台阶、两段分开的金属翼片、连接杆与细长格构桅杆；翼片为有厚度网格，换视角仍可见。
- 普通金属、主要竖向构件、塔冠使用不同材质，保留网页原有随时间控制的夜景 Shader 和米制 UV。
- 原五个网格移入隐藏且不导出的 `ARCHIVE Jin Mao imported baseline` 集合；保存时保留 `.blend1`，不删除旧模型。

## 复核与后续编辑

一次性建模脚本为 `design/space/scripts/refine_jin_mao.py`。默认只在后台内存中建模并渲染；`--baseline` 检查原版；`--night` 检查夜间材质层次；`--apply` 才保存。已含精修标记的工程拒绝重新生成，后续直接编辑 `.blend`。默认渲染结果在 `.tmp/png/space-jinmao/`。

新增 `Jin Mao` 和 `Jin Mao crown` 相机不导出。孤立模型 Cycles 审图用于比较几何与材质，临时环境光和夜间自发光不是网页照明的精确复现。网页完整光照及周边环境必须另验，不用 Blender 图片宣称网页达到电影级。

源文件保存后仍走现有 `batch.ps1 -Asset shanghai`，只导出这一份城市资产。页面来源与本文共用相同原始网址，维护入口是 `credits_data.json`。
