# 根号兽 · 像素日常

新增 10 支桌宠短片，每支 **12 秒、1920×1080、30 fps、无声循环**。每支采用独立背景和动作，沿用第一支视频的像素书桌风格。

- [打开本地预览页](./index.html)
- [30 秒总览](./30秒总览.mp4)
- [10 支 MP4 打包下载](./根号兽桌宠视频-10支.zip)
- [场景总览图](./总览.png)

| 序号 | 短片 | 场景与动作 | 动图 |
| --- | --- | --- | --- |
| 01 | [晨光问好](./videos/01-晨光问好.mp4) | 花枝与清晨日光，挥爪打招呼 | [GIF](./previews/01-晨光问好.gif) |
| 02 | [雨夜阅读](./videos/02-雨夜阅读.mp4) | 蓝紫雨夜，捧书翻页 | [GIF](./previews/02-雨夜阅读.gif) |
| 03 | [午后魔方](./videos/03-午后魔方.mp4) | 夕阳魔方工作台，练习复原 | [GIF](./previews/03-午后魔方.gif) |
| 04 | [深夜码字](./videos/04-深夜码字.mp4) | 城市夜景，双爪敲键盘 | [GIF](./previews/04-深夜码字.gif) |
| 05 | [星光魔术](./videos/05-星光魔术.mp4) | 星野与紫色小屋，挥动魔杖 | [GIF](./previews/05-星光魔术.gif) |
| 06 | [月亮晚安](./videos/06-月亮晚安.mp4) | 湖畔月色，抱着月亮入睡 | [GIF](./previews/06-月亮晚安.gif) |
| 07 | [甜点休息](./videos/07-甜点休息.mp4) | 奶油色花园茶室，吃小饼干 | [GIF](./previews/07-甜点休息.gif) |
| 08 | [快乐摇摆](./videos/08-快乐摇摆.mp4) | 唱片机与海湾夕照，跳一支小舞 | [GIF](./previews/08-快乐摇摆.gif) |
| 09 | [纸飞机出发](./videos/09-纸飞机出发.mp4) | 晴空远山工作台，放飞纸飞机 | [GIF](./previews/09-纸飞机出发.gif) |
| 10 | [方块杂耍](./videos/10-方块杂耍.mp4) | 雪景积木工坊，轮流抛接方块 | [GIF](./previews/10-方块杂耍.gif) |

## 制作素材

背景均使用内置 `image_gen.imagegen` 生成。每张的完整提示词与图片保存在 [source/backgrounds](./source/backgrounds/) 中，同名 `.prompt.txt` 对应 `.png`。生成参考为第一支视频的像素书桌背景。

动作复用仓库现有根号兽 SVG，保持红、蓝、白魔方造型及原始动作含义。08／09／10 仅在视频合成层调整接触阴影，使阴影跟随支撑脚；产品源码和原 SVG 未改动。魔方复原与吃点心会在每次动作完成后重新开始下一轮，属于情节循环。

每支的视频、GIF 和封面分别位于 `videos/`、`previews/`、`covers/`。`source/scenes/` 中保留了可以直接在浏览器打开的完整动画场景。ZIP 仅含 10 支完整 MP4，便于直接分享和剪辑。

## 导出与核对

在仓库根目录运行：

```sh
node output/rootbeast-desk-video-collection/source/render.ts
node output/rootbeast-desk-video-collection/source/package.ts
```

渲染脚本复用第一支视频的场景模板，使用一个常驻浏览器逐支导出，并保存帧缓存和完成记录。指定 `--only=08-dance-party,09-paper-plane,10-block-juggling` 可单独导出选定短片；`--preview` 仅输出封面和姿态抽帧。

每支输出均核对 12 秒、360 帧、1080p 与 H.264 编码。独立审阅了 10 组姿态抽帧、道具边界和桌面接触；每支的来源、时间倍率、文件探测结果与完成记录见 `source/qa/*.json`。交付清单及文件校验值见 `delivery.json`。
