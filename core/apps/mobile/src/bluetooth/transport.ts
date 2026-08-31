export interface BleDeviceRef {
  id: string;
  manufacturerData?: ReadonlyMap<number, Uint8Array>;
  name: string;
}

export interface BleDevicePickerLabels {
  availableDevices: string;
  cancel: string;
  noDeviceFound: string;
  scanning: string;
}

export interface BleRequestOptions {
  captureManufacturerData?: boolean;
  namePrefix: string;
  optionalServices?: string[];
  pickerLabels: BleDevicePickerLabels;
}

export interface BleTransport {
  connect(deviceId: string, onDisconnect: () => void): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  getMtu(deviceId: string): Promise<number | null>;
  initialize(): Promise<void>;
  read(deviceId: string, service: string, characteristic: string): Promise<DataView>;
  requestDevice(options: BleRequestOptions): Promise<BleDeviceRef>;
  subscribe(
    deviceId: string,
    service: string,
    characteristic: string,
    onValue: (value: DataView) => void,
  ): Promise<() => Promise<void>>;
  write(deviceId: string, service: string, characteristic: string, value: Uint8Array): Promise<void>;
}
