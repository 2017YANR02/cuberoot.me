import { describe, it, expect } from 'vitest';
import {
  describeError,
  errorName,
  isNoDeviceSelected,
  BluetoothConnectError,
  atStage,
  CONNECT_STAGE_LABEL,
  type ConnectStage,
} from '@/app/[lang]/timer/_lib/bluetooth/connect_error';

// 回归的是一份真实的、没法诊断的报告:iOS Bluefy 上「连接失败:2」。
//
// Bluefy 的 Web Bluetooth 走原生桥接,reject 的是裸值而不是 DOMException,那个
// `2` 就是原生错误码原样透出来的。老代码 `(err as Error).message ?? String(err)`
// 把它压成一个字符,name / code / 类型 / 断在哪一步全丢光。
//
// 所以这里锁两件事:①任意形状的 reject 值都要留下能读的信息(裸值必须带类型);
// ②「用户关掉了选择器」按 name 判,不按 instanceof —— 否则在 Bluefy 上取消选择
// 会弹一个红色报错,而在 Chrome 上是静默的。

describe('describeError', () => {
  it('keeps the type of a bare value — the Bluefy `2` case', () => {
    // 只写 '2' 是不够的:数字 2 和字符串 '2' 是两种不同的桥接行为,而这时候
    // 类型是我们仅有的额外线索。
    expect(describeError(2)).toBe('2 (number)');
    expect(describeError('2')).toBe('2');
    expect(describeError(0)).toBe('0 (number)');
    expect(describeError(false)).toBe('false (boolean)');
  });

  it('reads name + message off Error-shaped values', () => {
    expect(describeError(new Error('boom'))).toBe('Error: boom');
    expect(describeError(new TypeError('bad options'))).toBe('TypeError: bad options');
    expect(describeError({ name: 'NetworkError', message: 'GATT failed' }))
      .toBe('NetworkError: GATT failed');
  });

  it('keeps a numeric code even when a name is present', () => {
    // 原生桥接常把唯一有用的数字放在 code 上。
    expect(describeError({ name: 'NetworkError', code: 2 })).toBe('NetworkError (code 2)');
    expect(describeError({ code: 2 })).toBe('code 2');
  });

  it('does not repeat a code already visible in the text', () => {
    expect(describeError({ name: 'Err', message: 'failed with 7', code: 7 }))
      .toBe('Err: failed with 7');
  });

  it('handles values with nothing useful on them', () => {
    expect(describeError(null)).toBe('null');
    expect(describeError(undefined)).toBe('undefined');
    expect(describeError('')).toBe("'' (empty string)");
    expect(describeError('  ')).toBe("'' (empty string)");
    expect(describeError({})).toBe('[object Object]');
    expect(describeError({ status: 'closed' })).toBe('[object Object] {"status":"closed"}');
  });

  it('survives throwing getters and circular references', () => {
    const hostile = {
      get name(): string { throw new Error('nope'); },
      get message(): string { throw new Error('nope'); },
      get code(): number { throw new Error('nope'); },
    };
    expect(describeError(hostile)).toBe('[object Object]');

    const circular: { self?: unknown; kind: string } = { kind: 'loop' };
    circular.self = circular;
    expect(describeError(circular)).toBe('[object Object]');
  });
});

describe('errorName', () => {
  it('reads the name structurally, not via instanceof', () => {
    expect(errorName(new DOMException('x', 'NotFoundError'))).toBe('NotFoundError');
    expect(errorName({ name: 'NotFoundError' })).toBe('NotFoundError');
    expect(errorName({ name: '' })).toBe(null);
    expect(errorName(2)).toBe(null);
    expect(errorName(null)).toBe(null);
  });
});

describe('isNoDeviceSelected', () => {
  it('treats a dismissed chooser as "nothing picked", however it is shaped', () => {
    expect(isNoDeviceSelected(new DOMException('cancelled', 'NotFoundError'))).toBe(true);
    expect(isNoDeviceSelected(new DOMException('denied', 'NotAllowedError'))).toBe(true);
    // 桥接实现只是模仿了 spec 的 name,没继承 DOMException —— 一样算取消。
    expect(isNoDeviceSelected({ name: 'NotFoundError' })).toBe(true);
    expect(isNoDeviceSelected({ name: 'AbortError' })).toBe(true);
  });

  it('does NOT swallow an opaque native code', () => {
    // 这是关键:Bluefy 的 `2` 不知道是什么,绝不能当成「用户取消」吞掉,
    // 否则用户点了连接看到的是什么都没发生。
    expect(isNoDeviceSelected(2)).toBe(false);
    expect(isNoDeviceSelected('2')).toBe(false);
    expect(isNoDeviceSelected(new DOMException('gatt', 'NetworkError'))).toBe(false);
    expect(isNoDeviceSelected(null)).toBe(false);
  });
});

describe('BluetoothConnectError', () => {
  it('remembers the stage and the raw thrown value', () => {
    const err = new BluetoothConnectError('gatt', 2);
    expect(err.stage).toBe('gatt');
    expect(err.raw).toBe(2);
    expect(err.detail).toBe('2 (number)');
    expect(err.message).toBe('gatt: 2 (number)');
    expect(err instanceof Error).toBe(true);
  });

  it('atStage tags a bare value and passes tagged ones through untouched', () => {
    expect(atStage('picker', 2).stage).toBe('picker');
    // 内层(更具体)的阶段说了算:握手里抛出来的错不该在外层被重标成 picker。
    const inner = new BluetoothConnectError('handshake', 'key error');
    expect(atStage('picker', inner)).toBe(inner);
    expect(atStage('picker', inner).stage).toBe('handshake');
  });

  it('every stage has a bilingual label', () => {
    const stages: ConnectStage[] = [
      'adapter-asleep',
      'picker',
      'advertisement',
      'gatt',
      'discover',
      'handshake',
    ];
    for (const s of stages) {
      expect(CONNECT_STAGE_LABEL[s].zh.length).toBeGreaterThan(0);
      expect(CONNECT_STAGE_LABEL[s].en.length).toBeGreaterThan(0);
    }
    expect(Object.keys(CONNECT_STAGE_LABEL).sort()).toEqual([...stages].sort());
  });
});
