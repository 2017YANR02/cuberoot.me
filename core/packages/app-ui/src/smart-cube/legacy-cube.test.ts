import { expect, it, vi } from 'vitest';
import { createLegacyCubeSession } from '@cuberoot/shared/smart-cube/legacy-session';
import { SOLVED_SMART_CUBE_FACELETS } from '@cuberoot/shared/smart-cube/cubie';
import { GIIKER_DATA_SERVICE_UUID, GIIKER_NOTIFY_CHARACTERISTIC_UUID } from '@cuberoot/shared/smart-cube/giiker';
import { GOCUBE_NOTIFY_CHARACTERISTIC_UUID } from '@cuberoot/shared/smart-cube/gocube';
import { MOYU_TURN_CHARACTERISTIC_UUID } from '@cuberoot/shared/smart-cube/moyu';
import { GanCubeConnection } from './gan-cube';
import { LegacyCubeConnection } from './legacy-cube';
import type { BleTransport } from './transport';

function rig() {
  const listeners = new Map<string, (value: DataView) => void>();
  const stops = vi.fn(async () => undefined);
  const writes: number[][] = [];
  const nibbles = [...Array.from({length:8}, (_,i)=>i+1), ...Array(8).fill(0), ...Array.from({length:12}, (_,i)=>i+1), ...Array(12).fill(0)];
  const giiker = Uint8Array.from({ length: 20 }, (_,i) => nibbles[2*i]*16+nibbles[2*i+1]);
  const transport: BleTransport = {
    initialize: vi.fn(async () => {}), connect: vi.fn(async () => {}), disconnect: vi.fn(async () => {}),
    getMtu: vi.fn(async () => 517), requestDevice: vi.fn(async () => ({ id:'cube', name:'Gi123456' })),
    getServices: vi.fn(async () => [{ uuid:GIIKER_DATA_SERVICE_UUID, characteristics:[] }]),
    read: vi.fn(async () => new DataView(giiker.buffer)),
    write: vi.fn(async (_id,_s,_c,bytes) => { writes.push([...bytes]); }),
    subscribe: vi.fn(async (_id,_s,c,listener) => { listeners.set(c,listener); return stops; }),
  };
  const emit = (c: string, bytes: number[]) => listeners.get(c)!(new DataView(Uint8Array.from(bytes).buffer));
  return { transport, listeners, stops, writes, emit };
}

it('waits for an unsubscribe already in progress before allowing reconnect', async () => {
  let finishStop!: () => void;
  let receiveBattery!: (value: DataView) => void;
  const stop = vi.fn(() => new Promise<void>(resolve => { finishStop = resolve; }));
  const session = createLegacyCubeSession('giiker', {
    read: vi.fn(), write: vi.fn(async () => {}),
    subscribe: vi.fn(async (_service, _characteristic, receive) => { receiveBattery = receive; return stop; }),
  }, { onMove: vi.fn() });
  const battery = session.battery();
  await vi.waitFor(() => expect(receiveBattery).toBeTypeOf('function'));
  receiveBattery(new DataView(Uint8Array.of(0, 80).buffer));
  await vi.waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  const disposal = session.dispose();
  expect(session.dispose()).toBe(disposal);
  let done = false;
  void disposal.then(() => { done = true; });
  await Promise.resolve();
  expect(done).toBe(false);
  finishStop();
  await disposal;
  expect(await battery).toBe(80);
  expect(stop).toHaveBeenCalledTimes(1);
});

it('routes the ambiguous Gi name by service without asking for a GAN MAC', async () => {
  const fake=rig(); const onState=vi.fn(); const onNeedMac=vi.fn();
  const cube=new GanCubeConnection(fake.transport,{ onState,onNeedMac,onMove:vi.fn(),onDisconnect:vi.fn(),onProtocolError:vi.fn() });
  await cube.connect({id:'Apple-UUID',name:'Gi123456'});
  expect(cube.getProtocol()).toBe('giiker');
  expect(onNeedMac).not.toHaveBeenCalled();
  expect(onState).toHaveBeenCalledExactlyOnceWith(SOLVED_SMART_CUBE_FACELETS);
  await cube.disconnect();
  fake.emit(GIIKER_NOTIFY_CHARACTERISTIC_UUID, Array(20).fill(0));
  expect(onState).toHaveBeenCalledTimes(1);
});

it('streams GoCube state, turns, gyro and battery; ignores notifications after disconnect', async () => {
  const fake=rig(); const onState=vi.fn(); const onMove=vi.fn(); const onGyro=vi.fn(); const onStatus=vi.fn();
  const cube=new LegacyCubeConnection(fake.transport,{onState,onMove,onGyro,onStatus,onDisconnect:vi.fn()},'gocube');
  await cube.connect({id:'g',name:"Rubik's Connected"});
  const packet = (op:number,payload:number[]) => [0x2a,payload.length+4,op,...payload,0,13,10];
  fake.emit(GOCUBE_NOTIFY_CHARACTERISTIC_UUID,packet(2,Array.from({length:54},(_,i)=>Math.floor(i/9))));
  expect(onState).toHaveBeenCalledExactlyOnceWith(SOLVED_SMART_CUBE_FACELETS);
  fake.emit(GOCUBE_NOTIFY_CHARACTERISTIC_UUID,packet(1,[8,0]));
  expect(onMove).toHaveBeenCalledExactlyOnceWith('R');
  fake.emit(GOCUBE_NOTIFY_CHARACTERISTIC_UUID,packet(3,[...new TextEncoder().encode('0#0#0#16384')]));
  expect(onGyro).toHaveBeenCalledWith({x:0,y:0,z:0,w:1});
  fake.emit(GOCUBE_NOTIFY_CHARACTERISTIC_UUID,packet(5,[67]));
  expect(onStatus.mock.calls.at(-1)?.[0].battery).toBe(67);
  expect(fake.writes[0]).toEqual([0x33]);
  await cube.disconnect();
  fake.emit(GOCUBE_NOTIFY_CHARACTERISTIC_UUID,packet(1,[8,0]));
  expect(onMove).toHaveBeenCalledTimes(1);
});

it('supports old MoYu turns without inventing state or battery', async () => {
  const fake=rig(); const onMove=vi.fn(); const onState=vi.fn();
  const cube=new LegacyCubeConnection(fake.transport,{onMove,onState,onDisconnect:vi.fn()},'moyu');
  await cube.connect({id:'m',name:'MHC123'});
  fake.emit(MOYU_TURN_CHARACTERISTIC_UUID,[1,0,0,0,0,3,180]);
  expect(onMove).toHaveBeenCalledExactlyOnceWith('R');
  expect(onState).not.toHaveBeenCalled();
  expect(fake.writes).toEqual([]);
  await cube.disconnect();
});

it('releases a late subscription before finishing cancelled setup', async () => {
  const fake=rig(); let release!: () => void;
  fake.transport.subscribe=vi.fn(async () => { await new Promise<void>(resolve => {release=resolve;}); return fake.stops; });
  const cube=new LegacyCubeConnection(fake.transport,{onMove:vi.fn(),onDisconnect:vi.fn()},'gocube');
  const connecting=expect(cube.connect({id:'g',name:'GoCube'})).rejects.toThrow();
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  const disconnected=cube.disconnect();
  release(); await connecting; await disconnected;
  expect(fake.stops).toHaveBeenCalledTimes(1);
  expect(fake.transport.disconnect).toHaveBeenCalledWith('g');
});
