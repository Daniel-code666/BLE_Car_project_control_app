import { Injectable } from '@angular/core';
import { BleClient, BleDevice } from '@capacitor-community/bluetooth-le';
import {
    BLE_CHARACTERISTIC_UUID,
    BLE_DEVICE_NAME_PREFIX,
    BLE_SERVICE_UUID
} from './ble.constants';

@Injectable({
    providedIn: 'root'
})
export class BleService {
    private connectedDevice: BleDevice | null = null;

    private isWriting = false;

    async initialize(): Promise<void> {
        await BleClient.initialize();
    }

    async connect(): Promise<void> {
        await this.initialize();

        const device = await BleClient.requestDevice({
            name: BLE_DEVICE_NAME_PREFIX,
            optionalServices: [BLE_SERVICE_UUID]
        });

        await BleClient.connect(device.deviceId, () => { console.log('Dispositivo BLE desconectado', this.connectedDevice = null) });

        this.connectedDevice = device;

        console.log('Dispositivo BLE conectado', device)
    }

    async disconnect(): Promise<void> {
        if (!this.connectedDevice) {
            return;
        }

        await BleClient.disconnect(this.connectedDevice.deviceId);
        this.connectedDevice = null;

        console.log('Dispositivo BLE desconectado desde la app');
    }

    async writeValue(payload: string): Promise<void> {
        if (!this.connectedDevice) {
            console.warn('No hay dispositivo BLE conectado. Payload no enviado:', payload)
            return
        }

        const data = this.encodeText(payload)

        try {
            await BleClient.writeWithoutResponse(
                this.connectedDevice.deviceId,
                BLE_SERVICE_UUID,
                BLE_CHARACTERISTIC_UUID,
                data
            )

            console.log('Payload BLE enviado', payload)
        } finally {
            this.isWriting = false;
        }
    }

    isConnected(): boolean {
        return this.connectedDevice !== null;
    }

    getConnectedDeviceName(): string | null {
        return this.connectedDevice?.name ?? null;
    }

    private encodeText(text: string): DataView {
        const encoder = new TextEncoder()
        const encoded = encoder.encode(text)
        return new DataView(encoded.buffer)
    }
}