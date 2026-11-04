# 根号兽 · 夜晚书桌

- 成片：[根号兽-夜晚书桌-1080p.mp4](./根号兽-夜晚书桌-1080p.mp4)
- 动图：[根号兽-预览.gif](./根号兽-预览.gif)
- 封面：[封面.png](./封面.png)
- 可直接在浏览器打开的完整循环场景：[source/scene.html](./source/scene.html)
- 导出脚本：[source/render.ts](./source/render.ts)

12 秒，1920 × 1080，30 fps，H.264 MP4。保持参考录屏的无声形式。画面包括根号兽戴耳机点头、摆爪、表情变化，以及杯子热气、星光、流星、落叶和灯光变化。

根号兽直接复用仓库 `core/packages/client/public/deskpet/rootbeast/10-headphones.svg`，将 2.4 秒动作周期放慢到 3 秒，重复四次。制作时仓库提交为 `009f69da4e`。背景通过内置 image_gen 工具生成，再用 Chromium 按固定时间逐帧渲染并由 FFmpeg 编码。既有产品代码没有修改。

检查了成片的 360 帧、12 秒时长、1080p 尺寸、角色动作和循环边界；角色区域最后一帧与首帧平均通道差为 0.451/255，处于动作周期的自然接续处。

## 背景生成提示词

内置工具：`image_gen.imagegen`。参考输入为用户录屏中提取的房间画面，`transparent_background: false`。原始生成结果保存在 `source/background.png`。

```text
Create a new finished pixel-art background plate for a looping desktop-pet video. Use the attached extracted reference frame ONLY as reference for mood, medium and simple frontal room composition; do not reproduce its orange character. Landscape aspect ratio exactly 16:9, 1920x1080 if possible. A cozy little cuber's study at dusk, straight-on orthographic camera at desk height, beautiful restrained 16-bit pixel art with consistent crisp square pixels like a 480x270 game scene enlarged 4x, limited palette, no soft painterly rendering. Warm walnut-brown wall; large dark timber window on the LEFT occupying x=7%-48%, y=12%-65%, with dark blue violet dusk sky, a warm thin apricot horizon, tiny distant city silhouettes, a small crescent moon and sparse stars. Warm amber fairy lights along the ceiling. A broad honey-brown wooden desktop covers the bottom quarter, back edge at y=76%, front edge at y=94%. A small open dark laptop at lower left x=16%-34%, screen with a few short abstract colored code lines (no actual letters), tasteful tiny plant on left windowsill. An elegant glowing cream desk lamp on the RIGHT at x=88%, and two stacked books below it. A small ceramic mug at x=76%, y=83% with NO steam yet, since steam will be animated later. A tiny paper wall calendar at x=75%, y=21%-39%, just grid squares, no text. CRITICAL: leave the central desktop area x=40%-72%, y=43%-90% clear and empty for the animated mascot to be composited later. Center wall must be uncluttered. Sophisticated balanced warm amber vs indigo lighting, gentle stylized pools of light, no excessive decorative noise. No mascot, no creature, no person, no character silhouette, no labels, no logos, no watermark, no UI, no frame, no black letterbox. Full bleed illustration. This plate will be animated with a red-blue-white cube mascot in the empty center.
```

## 重新导出

在仓库根目录运行：

```sh
node output/rootbeast-desk-video/source/render.ts
```

脚本依赖现有 client 的 Playwright、Sharp、本机 Chrome 和 FFmpeg。帧缓存写入 `/tmp/rootbeast-video-frames`，成片写入本目录。直接打开 `source/scene.html` 不需要这些导出依赖。
