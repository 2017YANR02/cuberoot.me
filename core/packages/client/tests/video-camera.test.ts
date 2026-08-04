// 摄像头翻面的判定。失败模式全是「按钮在某类设备上不该出现却出现了 / 该出现却没有」,
// 而开发机(单摄像头笔记本)恰恰是唯一试不出问题的设备 —— 所以边界只能靠这里守。
import { describe, it, expect } from 'vitest';
import { canFlipCamera, facingOf, hasFacing, oppositeFacing } from '@/lib/video-camera';

describe('canFlipCamera — 按钮出不出现', () => {
  it('Android:settings 直接报朝向', () => {
    expect(canFlipCamera({ facingMode: 'user' }, undefined)).toBe(true);
    expect(canFlipCamera({ facingMode: 'environment' }, undefined)).toBe(true);
  });

  it('settings 不报、能力表报 —— 也算能翻', () => {
    // Safari 那边 settings 里填不填 facingMode 没人验证过(MDN browser-compat-data 里
    // safari / safari_ios 都是 null = 未知),所以能力表是必须的兜底:少了它,
    // 一旦 Safari 不填 settings,按钮就会在 iPhone 上消失 —— 而那正是它唯一该在的地方。
    expect(canFlipCamera({}, { facingMode: ['user', 'environment'] })).toBe(true);
    expect(canFlipCamera(undefined, { facingMode: ['environment'] })).toBe(true);
  });

  it('桌面摄像头:两处都报不出 → 不出现', () => {
    // 实测一台装了直播软件的 Windows 机器报 7 个 videoinput:1 个真摄像头 +
    // WebcastMate / vMix×4 / OBS 六个虚拟摄像头。它们都没有「朝向」。
    expect(canFlipCamera({}, {})).toBe(false);
    expect(canFlipCamera(undefined, undefined)).toBe(false);
    expect(canFlipCamera({}, { facingMode: [] })).toBe(false);
  });

  it('规范里那两个罕见值 left / right 不当作可翻面', () => {
    expect(canFlipCamera({ facingMode: 'left' }, undefined)).toBe(false);
    expect(canFlipCamera({}, { facingMode: ['left', 'right'] })).toBe(false);
  });

  it('空串不算', () => {
    expect(canFlipCamera({ facingMode: '' }, { facingMode: [''] })).toBe(false);
  });
});

describe('hasFacing — settings 报没报朝向', () => {
  it('只有 user / environment 算', () => {
    expect(hasFacing({ facingMode: 'user' })).toBe(true);
    expect(hasFacing({ facingMode: 'environment' })).toBe(true);
  });

  it('桌面摄像头、虚拟摄像头、拿不到 settings —— 都不算', () => {
    expect(hasFacing({})).toBe(false);
    expect(hasFacing({ facingMode: '' })).toBe(false);
    expect(hasFacing({ facingMode: 'left' })).toBe(false);
    expect(hasFacing(undefined)).toBe(false);
  });
});

describe('oppositeFacing — 翻面', () => {
  it('前后互换,翻两次回到原处', () => {
    expect(oppositeFacing('user')).toBe('environment');
    expect(oppositeFacing('environment')).toBe('user');
    expect(oppositeFacing(oppositeFacing('user'))).toBe('user');
  });
});

describe('facingOf — 决定镜像', () => {
  it('只有后置不镜像', () => {
    expect(facingOf({ facingMode: 'environment' })).toBe('environment');
  });

  it('前置、无朝向的桌面摄像头、拿不到 settings —— 一律按前置镜像', () => {
    expect(facingOf({ facingMode: 'user' })).toBe('user');
    expect(facingOf({})).toBe('user');
    expect(facingOf({ facingMode: '' })).toBe('user');
    expect(facingOf(undefined)).toBe('user');
  });
});
