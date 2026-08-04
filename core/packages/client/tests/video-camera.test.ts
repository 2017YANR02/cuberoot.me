// 摄像头切换的选择逻辑。这段的失败模式全是「在某类设备上点了没反应 / 换到奇怪的镜头」,
// 而开发机(单摄像头笔记本)恰恰是唯一试不出问题的设备 —— 所以边界只能靠这里守。
import { describe, it, expect } from 'vitest';
import { facingOf, nextCamera } from '@/lib/video-camera';

const CAMS = [{ deviceId: 'a' }, { deviceId: 'b' }, { deviceId: 'c' }];

describe('nextCamera — 手机翻面', () => {
  it('前置 → 后置', () => {
    expect(nextCamera({ facingMode: 'user', deviceId: 'a' }, CAMS)).toEqual({ facingMode: 'environment' });
  });

  it('后置 → 前置', () => {
    expect(nextCamera({ facingMode: 'environment', deviceId: 'b' }, CAMS)).toEqual({ facingMode: 'user' });
  });

  it('翻面时不带 deviceId —— 带上就等于同时约束「后置」和「就是这个镜头」,必然冲突', () => {
    const next = nextCamera({ facingMode: 'user', deviceId: 'a' }, CAMS);
    expect(next).not.toHaveProperty('deviceId');
  });

  it('Android 列了四个镜头也只翻一次面,不会轮到深度相机上', () => {
    const many = [{ deviceId: 'wide' }, { deviceId: 'ultra' }, { deviceId: 'tele' }, { deviceId: 'depth' }];
    expect(nextCamera({ facingMode: 'environment', deviceId: 'wide' }, many)).toEqual({ facingMode: 'user' });
  });
});

describe('nextCamera — 桌面按 deviceId 轮换', () => {
  it('没有朝向就走设备顺序', () => {
    expect(nextCamera({ deviceId: 'a' }, CAMS)).toEqual({ deviceId: 'b' });
  });

  it('轮到最后一个再点回到第一个', () => {
    expect(nextCamera({ deviceId: 'c' }, CAMS)).toEqual({ deviceId: 'a' });
  });

  it('当前设备不在列表里 → 回到第一个,而不是卡死不动', () => {
    expect(nextCamera({ deviceId: 'unplugged' }, CAMS)).toEqual({ deviceId: 'a' });
    expect(nextCamera(undefined, CAMS)).toEqual({ deviceId: 'a' });
  });

  it('facingMode 是规范里那两个罕见值(left/right)时按设备轮换,别拿它去翻面', () => {
    expect(nextCamera({ facingMode: 'left', deviceId: 'a' }, CAMS)).toEqual({ deviceId: 'b' });
  });
});

describe('nextCamera — 换不了就明说', () => {
  it('只有一个摄像头 → null(按钮该隐藏,而不是点了没反应)', () => {
    expect(nextCamera({ facingMode: 'user' }, [{ deviceId: 'a' }])).toBeNull();
  });

  it('一个都枚举不到 → null', () => {
    expect(nextCamera({ facingMode: 'user' }, [])).toBeNull();
  });
});

describe('facingOf — 决定镜像', () => {
  it('只有后置不镜像', () => {
    expect(facingOf({ facingMode: 'environment' })).toBe('environment');
  });

  it('前置、无朝向的桌面摄像头、拿不到 settings —— 一律按前置镜像', () => {
    expect(facingOf({ facingMode: 'user' })).toBe('user');
    expect(facingOf({ deviceId: 'a' })).toBe('user');
    expect(facingOf({ facingMode: '' })).toBe('user');
    expect(facingOf(undefined)).toBe('user');
  });
});
