export interface BleDeviceRef {
  id: string;
  manufacturerData?: ReadonlyMap<number, Uint8Array>;
  name: string;
}

/** GATT discovery data kept independent of Capacitor/Web BLE types. */
export interface BleServiceRef {
  uuid: string;
  characteristics: ReadonlyArray<{
    uuid: string;
    properties: {
      notify?: boolean;
      indicate?: boolean;
      read?: boolean;
      write?: boolean;
      writeWithoutResponse?: boolean;
    };
  }>;
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
  /** Additional prefixes for native pickers that can filter by service UUID. */
  namePrefixes?: readonly string[];
  optionalServices?: string[];
  /** Advertisement service filters; kept separate from optional GATT access. */
  services?: string[];
  pickerLabels: BleDevicePickerLabels;
}

export interface BleTransport {
  connect(deviceId: string, onDisconnect: () => void): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  getServices?(deviceId: string): Promise<BleServiceRef[]>;
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
