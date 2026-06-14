import { Injectable } from '@angular/core';
import { BleClient, BleDevice } from '@capacitor-community/bluetooth-le';
import {
  BLE_DEVICE_NAME_PREFIX,
  BLE_SERVICE_UUID
} from './ble.constants';

@Injectable({
  providedIn: 'root'
})
export class BleService {
  private connectedDevice: BleDevice | null = null;

  async initialize(): Promise<void> {
    await BleClient.initialize();
  }

  async connect(): Promise<void> {
    await this.initialize();

    const device = await BleClient.requestDevice({
      name: BLE_DEVICE_NAME_PREFIX,
      optionalServices: [BLE_SERVICE_UUID]
    });

    await BleClient.connect(device.deviceId);

    this.connectedDevice = device;
  }

  async disconnect(): Promise<void> {
    if (!this.connectedDevice) {
      return;
    }

    await BleClient.disconnect(this.connectedDevice.deviceId);
    this.connectedDevice = null;
  }

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDeviceName(): string | null {
    return this.connectedDevice?.name ?? null;
  }
}