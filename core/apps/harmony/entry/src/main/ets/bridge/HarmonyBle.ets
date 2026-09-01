import { access, ble, constant } from '@kit.ConnectivityKit';
import { BusinessError } from '@kit.BasicServicesKit';

const SCAN_TIMEOUT_MS = 8_000;
const CONNECT_TIMEOUT_MS = 12_000;
const GAN_SERVICE_UUID = '00000010-0000-fff7-fff6-fff5fff4fff0';
const GAN_NOTIFY_UUID = '0000fff6-0000-1000-8000-00805f9b34fb';
const GAN_WRITE_UUID = '0000fff5-0000-1000-8000-00805f9b34fb';

export type BleEventSink = (name: string, detail: Object) => void;

interface ManufacturerDataEntry {
  companyId: number;
  value: number[];
}

export interface SelectedBleDevice {
  id: string;
  manufacturerData: ManufacturerDataEntry[];
  name: string;
}

interface BleValueEvent {
  characteristic: string;
  deviceId: string;
  service: string;
  value: number[];
}

function bytes(value: ArrayBuffer): number[] {
  const data = new Uint8Array(value);
  const result: number[] = [];
  for (let index = 0; index < data.length; index++) result.push(data[index]);
  return result;
}

function arrayBuffer(value: number[]): ArrayBuffer {
  const data = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index++) data[index] = value[index];
  return data.buffer;
}

function sameUuid(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export class HarmonyBle {
  private connected: boolean = false;
  private connectionGeneration: number = 0;
  private deviceId: string = '';
  private eventSink: BleEventSink | undefined = undefined;
  private gatt: ble.GattClientDevice | undefined = undefined;
  private mtu: number = 23;
  private readonly selectedDeviceIds: Set<string> = new Set();
  private services: ble.GattService[] = [];

  setEventSink(sink: BleEventSink): void {
    this.eventSink = sink;
  }

  async initialize(): Promise<void> {
    let state: access.BluetoothState;
    try {
      state = access.getState();
    } catch (error) {
      throw error as Error;
    }
    if (state === access.BluetoothState.STATE_ON) return;
    await new Promise<void>((resolve, reject) => {
      let finished = false;
      const finish = (error?: Error): void => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        try {
          access.off('stateChange', onStateChange);
        } catch (_) {
        }
        if (error) reject(error);
        else resolve();
      };
      const onStateChange = (next: access.BluetoothState): void => {
        if (next === access.BluetoothState.STATE_ON) finish();
        else if (next === access.BluetoothState.STATE_OFF) finish(new Error('Bluetooth unavailable'));
      };
      const timeout = setTimeout(() => finish(new Error('Bluetooth enable timeout')), CONNECT_TIMEOUT_MS);
      access.on('stateChange', onStateChange);
      try {
        access.enableBluetooth();
      } catch (error) {
        finish(error as Error);
      }
    });
  }

  requestDevice(namePrefix: string): Promise<SelectedBleDevice> {
    return new Promise((resolve, reject) => {
      let selected: ble.ScanResult | undefined = undefined;
      let finished = false;
      const finish = (): void => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        try {
          ble.stopBLEScan();
        } catch (_) {
        }
        try {
          ble.off('BLEDeviceFind', onDeviceFind);
        } catch (_) {
        }
        if (!selected) {
          reject(new Error('No GAN smart cube found'));
          return;
        }
        const manufacturerData: ManufacturerDataEntry[] = [];
        selected.manufacturerDataMap?.forEach((value: Uint8Array, companyId: number) => {
          manufacturerData.push({ companyId, value: bytes(value.buffer as ArrayBuffer) });
        });
        this.selectedDeviceIds.add(selected.deviceId);
        resolve({
          id: selected.deviceId,
          manufacturerData,
          name: selected.deviceName || namePrefix
        });
      };
      const onDeviceFind = (results: ble.ScanResult[]): void => {
        for (const result of results) {
          if (!result.deviceName.startsWith(namePrefix)) continue;
          if (!selected || result.rssi > selected.rssi) selected = result;
        }
      };
      const timeout = setTimeout(finish, SCAN_TIMEOUT_MS);
      try {
        ble.on('BLEDeviceFind', onDeviceFind);
        const options: ble.ScanOptions = {
          interval: 0,
          dutyMode: ble.ScanDuty.SCAN_MODE_LOW_LATENCY,
          matchMode: ble.MatchMode.MATCH_MODE_AGGRESSIVE
        };
        ble.startBLEScan([], options);
      } catch (error) {
        clearTimeout(timeout);
        try {
          ble.stopBLEScan();
        } catch (_) {
        }
        try {
          ble.off('BLEDeviceFind', onDeviceFind);
        } catch (_) {
        }
        reject(error as Error);
      }
    });
  }

  async connect(deviceId: string): Promise<void> {
    if (!this.selectedDeviceIds.has(deviceId)) throw new Error('Bluetooth device was not selected');
    if (this.gatt) await this.disconnect(this.deviceId);
    const generation = ++this.connectionGeneration;
    this.deviceId = deviceId;
    let gatt: ble.GattClientDevice;
    try {
      gatt = ble.createGattClientDevice(deviceId);
    } catch (error) {
      throw error as Error;
    }
    this.gatt = gatt;
    try {
      gatt.on('BLECharacteristicChange', (value: ble.BLECharacteristic) => {
        if (this.gatt !== gatt || this.connectionGeneration !== generation) return;
        const event: BleValueEvent = {
          characteristic: value.characteristicUuid,
          deviceId,
          service: value.serviceUuid,
          value: bytes(value.characteristicValue)
        };
        this.eventSink?.('cuberoot:ble-value', event);
      });
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve();
        };
        const timeout = setTimeout(() => finish(new Error('Bluetooth connection timeout')), CONNECT_TIMEOUT_MS);
        gatt.on('BLEConnectionStateChange', (change: ble.BLEConnectionChangeState) => {
          if (this.gatt !== gatt || this.connectionGeneration !== generation) return;
          if (change.state === constant.ProfileConnectionState.STATE_CONNECTED) {
            this.connected = true;
            gatt.getServices().then((services: ble.GattService[]): void => {
              if (this.gatt !== gatt || this.connectionGeneration !== generation) return;
              this.services = services;
              this.mtu = 23;
              finish();
            }).catch((error: BusinessError) => {
              finish(error as Error);
            });
            return;
          }
          if (change.state === constant.ProfileConnectionState.STATE_DISCONNECTED) {
            const wasConnected = this.connected;
            this.connected = false;
            if (!settled) finish(new Error('Bluetooth disconnected while connecting'));
            else if (wasConnected) {
              this.gatt = undefined;
              this.services = [];
              this.mtu = 23;
              this.closeGatt(gatt, false);
              this.eventSink?.('cuberoot:ble-disconnect', deviceId);
            }
          }
        });
        try {
          gatt.connect();
        } catch (error) {
          finish(error as Error);
        }
      });
    } catch (error) {
      if (this.gatt === gatt && this.connectionGeneration === generation) {
        await this.disconnect(deviceId);
      }
      throw error as Error;
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const gatt = this.gatt;
    if (gatt && deviceId !== this.deviceId) throw new Error('Bluetooth device mismatch');
    this.connectionGeneration++;
    this.gatt = undefined;
    this.connected = false;
    this.services = [];
    this.mtu = 23;
    if (!gatt) return;
    this.closeGatt(gatt, true);
  }

  private closeGatt(gatt: ble.GattClientDevice, shouldDisconnect: boolean): void {
    try {
      gatt.off('BLEConnectionStateChange');
    } catch (_) {
    }
    try {
      gatt.off('BLECharacteristicChange');
    } catch (_) {
    }
    if (shouldDisconnect) {
      try {
        gatt.disconnect();
      } catch (_) {
      }
    }
    try {
      gatt.close();
    } catch (_) {
    }
  }

  async release(): Promise<void> {
    if (this.gatt) await this.disconnect(this.deviceId);
    this.eventSink = undefined;
    this.selectedDeviceIds.clear();
  }

  getMtu(deviceId: string): number | null {
    return this.requireDevice(deviceId) ? this.mtu : null;
  }

  async read(deviceId: string, service: string, characteristic: string): Promise<number[]> {
    this.ensureGanCharacteristic(service, characteristic);
    const gatt = this.requireGatt(deviceId);
    const target = this.findCharacteristic(service, characteristic);
    try {
      const result = await gatt.readCharacteristicValue(target);
      return bytes(result.characteristicValue);
    } catch (error) {
      throw error as Error;
    }
  }

  async write(deviceId: string, service: string, characteristic: string, value: number[]): Promise<void> {
    if (!sameUuid(service, GAN_SERVICE_UUID) || !sameUuid(characteristic, GAN_WRITE_UUID)) {
      throw new Error('Bluetooth write characteristic denied');
    }
    const gatt = this.requireGatt(deviceId);
    if (value.length < 1 || value.length > this.mtu - 3) throw new Error('Bluetooth write value too large');
    const target = this.findCharacteristic(service, characteristic);
    const outbound: ble.BLECharacteristic = {
      serviceUuid: target.serviceUuid,
      characteristicUuid: target.characteristicUuid,
      characteristicValue: arrayBuffer(value),
      descriptors: target.descriptors,
      properties: target.properties,
      characteristicValueHandle: target.characteristicValueHandle,
      permissions: target.permissions
    };
    const writeType = target.properties?.write === false && target.properties?.writeNoResponse
      ? ble.GattWriteType.WRITE_NO_RESPONSE
      : ble.GattWriteType.WRITE;
    try {
      await gatt.writeCharacteristicValue(outbound, writeType);
    } catch (error) {
      throw error as Error;
    }
  }

  async setNotification(
    deviceId: string,
    service: string,
    characteristic: string,
    enabled: boolean
  ): Promise<void> {
    if (!sameUuid(service, GAN_SERVICE_UUID) || !sameUuid(characteristic, GAN_NOTIFY_UUID)) {
      throw new Error('Bluetooth notification characteristic denied');
    }
    const gatt = this.requireGatt(deviceId);
    const target = this.findCharacteristic(service, characteristic);
    await new Promise<void>((resolve, reject) => {
      try {
        gatt.setCharacteristicChangeNotification(target, enabled, (error: BusinessError) => {
          if (error) reject(error);
          else resolve();
        });
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  private requireDevice(deviceId: string): boolean {
    return this.connected && this.deviceId === deviceId;
  }

  private requireGatt(deviceId: string): ble.GattClientDevice {
    if (!this.gatt || !this.requireDevice(deviceId)) throw new Error('Bluetooth device not connected');
    return this.gatt;
  }

  private findCharacteristic(service: string, characteristic: string): ble.BLECharacteristic {
    for (const candidateService of this.services) {
      if (!sameUuid(candidateService.serviceUuid, service)) continue;
      for (const candidate of candidateService.characteristics) {
        if (sameUuid(candidate.characteristicUuid, characteristic)) return candidate;
      }
    }
    throw new Error('Bluetooth characteristic unavailable');
  }

  private ensureGanCharacteristic(service: string, characteristic: string): void {
    const allowed = sameUuid(service, GAN_SERVICE_UUID) &&
      (sameUuid(characteristic, GAN_NOTIFY_UUID) || sameUuid(characteristic, GAN_WRITE_UUID));
    if (!allowed) throw new Error('Bluetooth characteristic denied');
  }
}
