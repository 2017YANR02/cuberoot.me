import { describe, expect, it, vi } from 'vitest';
import { createNativeTimerSource } from './timer-source';
import type { BleTransport } from './transport';
import { crc16CcittFalse } from '@cuberoot/shared/timer/external/crc';
const labels = {availableDevices:'Timers', cancel:'Cancel', noDeviceFound:'None', scanning:'Scan'};
function fixture() {
  let listener: (value: DataView) => void = () => {};
  const transport: BleTransport = {
    initialize: vi.fn(async () => {}), requestDevice: vi.fn(async () => ({id:'timer',name:'GAN Timer'})),
    connect: vi.fn(async () => {}), disconnect: vi.fn(async () => {}), getMtu: async () => null,
    read: async () => new DataView(new ArrayBuffer(0)), write: vi.fn(async () => {}),
    subscribe: vi.fn(async (_id,_s,_c,cb) => {listener=cb; return async () => {}; }),
  };
  const source = createNativeTimerSource(transport, labels, {});
  function send(state: number, ms = 0) {
    const data = new Uint8Array(10); data[0]=0xfe;data[1]=8;data[3]=state;data[5]=Math.floor(ms/1000); new DataView(data.buffer).setUint16(6,ms%1000,true);
    new DataView(data.buffer).setUint16(8,crc16CcittFalse(data.slice(2,8)),true); listener(new DataView(data.buffer));
  }
  return {transport,source,send};
}
describe('native smart timer lifecycle', () => {
  it('releases a native connection that finishes after cancellation', async () => {
    const {transport,source} = fixture();
    let finish!: () => void;
    let entered!: () => void; const started=new Promise<void>(r=>entered=r);
    vi.mocked(transport.connect).mockImplementation(() => {entered(); return new Promise<void>(r=>finish=r);});
    const connecting=source.connect(); const outcome=connecting.catch(error=>error);
    await started;
    const disconnecting=source.disconnect();
    expect(transport.disconnect).not.toHaveBeenCalled();
    finish(); await disconnecting; await outcome;
    expect(transport.disconnect).toHaveBeenCalledWith('timer');
    expect(source.connected).toBe(false);
    expect(transport.subscribe).not.toHaveBeenCalled();
  });
  it('keeps hardware milliseconds and drops late frames after manual disconnect', async () => {
    const {source,send}=fixture(); const events: unknown[]=[];source.subscribe(event=>events.push(event));
    await source.connect(); send(3);send(4,12345);
    expect(source.lastTimeMs).toBe(12345);
    expect(events).toContainEqual({state:'STOPPED',solveTime:12345});
    await source.disconnect();const count=events.length;send(4,23456);expect(events).toHaveLength(count);
  });
  it('does not reset a valid RUNNING event received while subscribing', async () => {
    const {transport,source,send}=fixture();const events: unknown[]=[];source.subscribe(event=>events.push(event));
    const original=transport.subscribe;
    transport.subscribe=async (...args) => {const unsubscribe=await original(...args);send(3);return unsubscribe;};
    await source.connect();expect(source.state).toBe('RUNNING');expect(events).not.toContainEqual({state:'IDLE'});
    await source.disconnect();
  });
});
