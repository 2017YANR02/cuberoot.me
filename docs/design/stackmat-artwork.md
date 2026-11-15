# StackMat 矢量图与虚拟感应区

本地实现：`core/packages/client/components/StackmatTimerArtwork.tsx`。图库与 Web 计时器复用此入口，型号及五代涂装来自 `stackmat-catalog.ts`，LCD 复用已有七段数字路径。图库可下载当前型号/涂装的独立 SVG；不嵌入照片、不依赖外部字体。计时器数字、观察、处罚和成绩保存仍由原计时引擎负责。

## 外观参考

- G1：[历史资料照片](https://cccstore.ru/blog/articles/istoriya-razvitiya-taymerov-dlya-spidkubinga-ot-pervykh-modeley-do-nashikh-dney/)。该文章标作 G2 的照片实际有 QJ 标志，未采用。
- G2：[Wikimedia 的 Stackmatresized.jpg](https://commons.wikimedia.org/wiki/File:Stackmatresized.jpg)，蓝壳、银色面板和记忆按钮。
- G3：[Speed Stacks 原厂 StackMat Pro 照片](https://www.speedstacks.com/store/products/_img/03612/stackmat_pro.jpg)。
- G4：[Speed Stacks 原厂产品图](https://www.speedstacks.com/store/_img/timer_g4.png)，细节交叉核对 [TheCubicle 的 Gen4 实物照片](https://www.thecubicle.com/products/stackmat-pro-timer-gen4)。
- G5：[Speed Stacks 产品页](https://www.speedstacks.com/store/retail/speed-stacks-g5-timer/)，原版、Blackout、Black Mist、Phantom；操作参考[原厂 G5 介绍](https://www.speedstacks.com/news/2021-02-28/new-g5-timer/)。

五代拇指指纹另按[原厂 1920px Blackout 图](https://www.speedstacks.com/store/_img/_hd/03020.png)重绘：保留连续回旋纹、分段短纹和断口，左右镜像，四种涂装共用路径。

均为依照片近似重绘，不是原厂 CAD。旧款小字、塑料纹理与涂装细纹做了简化；没有将五代机身换色后标成旧代。五代中心徽标上方已按用户要求移除黄色装饰，保留此决定。

2026-11-06 校对：G1/G2 继续以历史实物照片为依据（尚无清晰原厂正视图），G3/G4 核对以上原厂图片。G1–G4 的手掌印复用分段品牌轮廓；G4 电源、复位、记忆键和指示灯重新定位，电源/复位键完整留在银色面板内；G1–G3 底部字标上移、缩小以留出边距。仍属于照片近似矢量重绘，未宣称尺寸或纹理与原物完全相同。

## 输入

设置 → 外观 → 计时显示：数字、大显、史塔克一至五代。五代额外选择涂装和普通 / 2-Pad / 4-Pad。旧设置默认保留普通输入，未知值回退到有效默认值。

- 普通：沿用原空格、点击与原预备阈值。
- 2-Pad：左右掌区均按住 550ms 变绿；松开任一区起表，计时中同时按下两区停表。
- 4-Pad：两掌区及两拇指区均按住 550ms 变绿；松开任一区起表，计时中四区齐按停表。
- 按区模式的 550ms 为网页预备间隔，设置中显示为不可编辑，不覆盖用户的普通模式阈值。
- 单人键盘：2-Pad 为 A/F，4-Pad 为 A/S/D/F。多人第二至四组分别为 J/K/L/分号、Q/W/E/R、U/I/O/P；2-Pad 取每组两端。各区标注相应按键，触屏可直接多点操作。键盘需要支持对应数量的同时按键。
- 停表后全部触点抬起才能再次准备。失焦、取消触摸、异常丢失指针捕获、打开弹窗或切换模式会取消正在准备的触点，不把取消视作松手起表。
- 普通单键、空白区域点击在按区模式下不参与起停。硬件 StackMat / 蓝牙计时器和智能魔方仍走各自原有输入，单人虚拟感应区在这些连接有效时禁用。

这是网页触点/键盘模拟，不是读取实体感应片，也未模拟硬件开关机、记忆键或五秒切换模式手势。联机调用原房间状态与计时接口，不绕过准备状态。没有变更已有大显视频的八种下载规格。

## 本轮验证

- 客户端类型检查；多触点输入纯逻辑回归。
- Headless Chrome：2/4 键起停、缺区不启动、空格不能误停、四点触摸起停、触点取消不误启动、本地双人按键隔离、390px 布局、设置型号选择和图库选择。
- 独立 SVG 全图与放大细节渲染检查。
- 联机已接线，未以真实多人房间验证；未以实体手机验证四指触控或实体键盘验证同时按键上限。
