// Animation gallery data for the desk-pet "图鉴 / Animations" panel.
// Each character's showcase animations (internal mini-/react-/drag poses omitted).
// Files live under public/deskpet/<base>; the gallery renders them as plain <img>,
// so states the runtime state-machine doesn't drive yet still preview here.

export interface PetAnim {
  file: string;
  zh: string;
  en: string;
}

export interface PetGalleryGroup {
  id: string;
  zh: string;
  en: string;
  base: string;
  anims: PetAnim[];
  // SVGs whose animation is driven by an embedded <script> (cloudling). Scripts
  // don't run inside <img>, so these must render via <object> or they show a
  // blank/initial frame. CSS-keyframe SVGs (cubing/clawd) and .apng animate in <img>.
  scripted?: boolean;
  // Optional CSS zoom: several characters are authored small inside a large canvas
  // (cloud centered with float headroom; pixel crab/pig sitting low with jump
  // headroom above), so they read tiny at native scale — bump to match the cats.
  // The media cell clips overflow, so scaleOrigin anchors where the figure sits
  // (e.g. 'center 82%' keeps a ground-standing sprite's feet in frame).
  scale?: number;
  scaleOrigin?: string;
}

export const PET_GALLERY: PetGalleryGroup[] = [
  {
    id: 'cubing', zh: '魔方秀 Cube Show', en: 'Cube Show', base: '/deskpet/cubing/', scale: 1.85, scaleOrigin: 'center 82%',
    anims: [
      { file: 'a01-iso-sexy-solve.svg', zh: '等距解魔方', en: 'Sexy-move solve' },
      { file: 'a01-iso-crank-solve.svg', zh: '转角解魔方', en: 'Corner crank' },
      { file: 'a01-front-turn-solve.svg', zh: '正面拧魔方', en: 'Front turn' },
      { file: 'a02-faceturn-showcase.svg', zh: '转体展示', en: 'Y-axis showcase' },
      { file: 'a02-spin-snap.svg', zh: '棘轮快转', en: 'Ratchet spin' },
      { file: 'a02-spin-lean.svg', zh: '炫耀慢转', en: 'Proud spin' },
      { file: 'a03-lcd-spin.svg', zh: '转方块', en: 'LCD spin' },
      { file: 'a03-frame-solve.svg', zh: '拼方块', en: 'Frame solve' },
      { file: 'a03-lcd-twist.svg', zh: '转一层', en: 'U-layer twist' },
      { file: 'a04-one-claw-r-turn.svg', zh: '单钳拧右层', en: 'One-claw R-turn' },
      { file: 'a04-show-off-spin.svg', zh: '炫技转体', en: 'Show-off spin' },
      { file: 'a04-snap-frames.svg', zh: '咔嗒定帧', en: 'Snap frames' },
      { file: 'a05-fidget-twist.svg', zh: '拧一下', en: 'Idle twist' },
      { file: 'a05-fidget-roll.svg', zh: '转一转', en: 'Lazy roll' },
      { file: 'a05-fidget-flip.svg', zh: '翻一翻', en: 'Idle flip' },
      { file: 'a06-01-layer-solve.svg', zh: '分层复原', en: 'Layer solve' },
      { file: 'a06-02-slide-shuffle.svg', zh: '滑块洗乱', en: 'Slide shuffle' },
      { file: 'a06-03-flicker-reveal.svg', zh: '闪烁复原', en: 'Flicker reveal' },
      { file: 'a07-speedsolve-pb.svg', zh: '破纪录速拧', en: 'Speedsolve PB' },
      { file: 'a07-two-face-spin.svg', zh: '双面转体', en: 'Two-face spin' },
      { file: 'a07-lcd-speedstack.svg', zh: '掌机速解', en: 'LCD speedstack' },
      { file: 'a08-top-u-turn.svg', zh: '俯视拧U面', en: 'Top-down U-turn' },
      { file: 'a08-side-roll.svg', zh: '翻滚过桌', en: 'Side roll' },
      { file: 'a08-turntable-spin.svg', zh: '转盘旋转', en: 'Turntable spin' },
      { file: 'a09-peek-double-take.svg', zh: '偷看变脸', en: 'Peek double-take' },
      { file: 'a09-startle-spin-peek.svg', zh: '惊吓转面', en: 'Startle spin' },
      { file: 'a09-shy-peek-frames.svg', zh: '害羞偷看', en: 'Shy peek' },
      { file: 'a10-victory-jump.svg', zh: '胜利跳跃', en: 'Victory jump' },
      { file: 'a10-cube-raise-cheer.svg', zh: '举杯欢呼', en: 'Cube raise' },
      { file: 'a10-pb-sparkle-dance.svg', zh: '新纪录舞', en: 'PB dance' },
    ],
  },
  {
    id: 'clawd', zh: '螃蟹 Clawd', en: 'Clawd', base: '/deskpet/', scale: 1.85, scaleOrigin: 'center 82%',
    anims: [
      { file: 'clawd-idle-look.svg', zh: '待机', en: 'Idle' },
      { file: 'clawd-idle-bubble.svg', zh: '冒泡', en: 'Thought Bubble' },
      { file: 'clawd-working-thinking.svg', zh: '思考', en: 'Thinking' },
      { file: 'clawd-working-typing.svg', zh: '打字', en: 'Typing' },
      { file: 'clawd-working-building.svg', zh: '搭建', en: 'Building' },
      { file: 'clawd-headphones-groove.svg', zh: '戴耳机', en: 'Groove' },
      { file: 'clawd-working-juggling.svg', zh: '抛接', en: 'Juggling' },
      { file: 'clawd-working-sweeping.svg', zh: '打扫', en: 'Sweeping' },
      { file: 'clawd-working-carrying.svg', zh: '搬运', en: 'Carrying' },
      { file: 'clawd-working-debugger.svg', zh: '调试', en: 'Debugger' },
      { file: 'clawd-working-wizard.svg', zh: '施法', en: 'Wizard' },
      { file: 'clawd-working-ultrathink.svg', zh: '深度思考', en: 'Ultrathink' },
      { file: 'clawd-working-typing-boss.svg', zh: '老板模式', en: 'Boss' },
      { file: 'clawd-happy.svg', zh: '开心', en: 'Happy' },
      { file: 'clawd-error.svg', zh: '出错', en: 'Error' },
      { file: 'clawd-notification.svg', zh: '提醒', en: 'Notification' },
      { file: 'clawd-idle-reading.svg', zh: '阅读', en: 'Reading' },
      { file: 'clawd-idle-yawn.svg', zh: '打哈欠', en: 'Yawn' },
      { file: 'clawd-idle-doze.svg', zh: '打盹', en: 'Doze' },
      { file: 'clawd-sleeping.svg', zh: '睡觉', en: 'Sleeping' },
      { file: 'clawd-wake.svg', zh: '醒来', en: 'Waking' },
    ],
  },
  {
    id: 'calico', zh: '三花猫 Calico', en: 'Calico', base: '/deskpet/calico/',
    anims: [
      { file: 'calico-idle.apng', zh: '待机', en: 'Idle' },
      { file: 'calico-thinking.apng', zh: '思考', en: 'Thinking' },
      { file: 'calico-working-typing.apng', zh: '打字', en: 'Typing' },
      { file: 'calico-working-building.apng', zh: '搭建', en: 'Building' },
      { file: 'calico-working-juggling.apng', zh: '抛接', en: 'Juggling' },
      { file: 'calico-working-conducting.apng', zh: '指挥', en: 'Conducting' },
      { file: 'calico-working-sweeping.apng', zh: '打扫', en: 'Sweeping' },
      { file: 'calico-working-carrying.apng', zh: '搬运', en: 'Carrying' },
      { file: 'calico-happy.apng', zh: '开心', en: 'Happy' },
      { file: 'calico-error.apng', zh: '出错', en: 'Error' },
      { file: 'calico-notification.apng', zh: '提醒', en: 'Notification' },
      { file: 'calico-yawning.apng', zh: '打哈欠', en: 'Yawn' },
      { file: 'calico-sleeping.apng', zh: '睡觉', en: 'Sleeping' },
      { file: 'calico-waking.apng', zh: '醒来', en: 'Waking' },
    ],
  },
  {
    id: 'cloudling', zh: '云宝 Cloudling', en: 'Cloudling', base: '/deskpet/cloudling/', scripted: true, scale: 1.5, scaleOrigin: 'center 45%',
    anims: [
      { file: 'cloudling-idle.svg', zh: '待机', en: 'Idle' },
      { file: 'cloudling-thinking.svg', zh: '思考', en: 'Thinking' },
      { file: 'cloudling-typing.svg', zh: '打字', en: 'Typing' },
      { file: 'cloudling-building.svg', zh: '搭建', en: 'Building' },
      { file: 'cloudling-juggling.svg', zh: '抛接', en: 'Juggling' },
      { file: 'cloudling-conducting.svg', zh: '指挥', en: 'Conducting' },
      { file: 'cloudling-sweeping.svg', zh: '打扫', en: 'Sweeping' },
      { file: 'cloudling-carrying.svg', zh: '搬运', en: 'Carrying' },
      { file: 'cloudling-attention.svg', zh: '注意', en: 'Attention' },
      { file: 'cloudling-error.svg', zh: '出错', en: 'Error' },
      { file: 'cloudling-notification.svg', zh: '提醒', en: 'Notification' },
      { file: 'cloudling-idle-reading.svg', zh: '阅读', en: 'Reading' },
      { file: 'cloudling-dozing.svg', zh: '打盹', en: 'Doze' },
      { file: 'cloudling-sleeping.svg', zh: '睡觉', en: 'Sleeping' },
    ],
  },
];
