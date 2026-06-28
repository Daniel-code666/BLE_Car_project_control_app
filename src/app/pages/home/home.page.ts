import { Component } from '@angular/core';
import { IonButton, IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { BleService } from '../../core/ble/ble.service';
import { CarConnectionState, ControlState, PowerMode } from '../../core/car/car-state';
import { PAYLOAD_EMIT_INTERVAL_MS } from '../../core/ble/ble.constants';
import {
  bluetooth,
  carSport,
  radioButtonOn,
  swapHorizontal,
  stopCircle,
  speedometer,
  flash,
  leaf
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonIcon
  ]
})
export class HomePage {
  readonly CarConnectionState = CarConnectionState;
  readonly PowerMode = PowerMode;

  connectionStatus: CarConnectionState = CarConnectionState.Disconnected;
  lastCommand = 'Sin comandos';
  lastPayload = 'Sin datos';

  controlsReversed = false;
  powerMode: PowerMode = PowerMode.Normal;

  throttleValue = 0;
  steeringValue = 0;
  brakeActive = false;

  maxOffset = 72;

  private draggingThrottle = false;
  private draggingSteering = false;

  private lastEmittedPayload = '';
  private lastPayloadSentAt = 0;
  private pendingPayloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly bleService: BleService) {
    addIcons({
      bluetooth,
      carSport,
      radioButtonOn,
      swapHorizontal,
      stopCircle,
      speedometer,
      flash,
      leaf,
    });
  }

  async connect(): Promise<void> {
    try {
      this.connectionStatus = CarConnectionState.Connecting;

      await this.bleService.connect();

      this.connectionStatus = CarConnectionState.Connected;
    } catch (error) {
      console.error('Error al conectar:', error);
      this.connectionStatus = CarConnectionState.Error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.connectionStatus = CarConnectionState.Disconnecting;

      this.clearPendingPayloadTimer();

      await this.bleService.disconnect();

      this.connectionStatus = CarConnectionState.Disconnected;
      this.lastEmittedPayload = '';
    } catch (error) {
      console.error('Error al desconectar:', error);
      this.connectionStatus = CarConnectionState.Error;
    }
  }

  setPowerMode(mode: PowerMode): void {
    this.powerMode = mode;
    this.emitControlState();
  }

  toggleControlsPosition(): void {
    this.controlsReversed = !this.controlsReversed;
  }

  startThrottle(event: PointerEvent): void {
    this.draggingThrottle = true;
    this.updateThrottle(event);
  }

  moveThrottle(event: PointerEvent): void {
    if (!this.draggingThrottle) {
      return;
    }

    this.updateThrottle(event);
  }

  endThrottle(event?: PointerEvent): void {
    event?.preventDefault();

    this.draggingThrottle = false;
    this.throttleValue = 0;

    this.emitControlState(true);
  }

  startSteering(event: PointerEvent): void {
    this.draggingSteering = true;
    this.updateSteering(event);
  }

  moveSteering(event: PointerEvent): void {
    if (!this.draggingSteering) {
      return;
    }

    this.updateSteering(event);
  }

  endSteering(event?: PointerEvent): void {
    event?.preventDefault();

    this.draggingSteering = false;
    this.steeringValue = 0;

    this.emitControlState(true);
  }

  stopAll(event?: Event): void {
    event?.preventDefault();

    this.draggingThrottle = false;
    this.draggingSteering = false;

    this.throttleValue = 0;
    this.steeringValue = 0;
    this.brakeActive = false;

    this.emitControlState(true);
  }

  startBrake(event?: Event): void {
    event?.preventDefault();

    this.draggingThrottle = false;
    this.draggingSteering = false;

    this.throttleValue = 0;
    this.steeringValue = 0;
    this.brakeActive = true;

    this.emitControlState(true);
  }

  endBrake(event?: Event): void {
    event?.preventDefault();

    this.brakeActive = false;

    this.emitControlState(true);
  }

  getThrottleKnobPosition(): string {
    const offset = -(this.throttleValue / 100) * this.maxOffset;

    return `translate(-50%, calc(-50% + ${offset}px))`;
  }

  getSteeringKnobPosition(): string {
    const offset = (this.steeringValue / 100) * this.maxOffset;

    return `translate(calc(-50% + ${offset}px), -50%)`;
  }

  DisableButtonByConnectionStatus(): boolean {
    return this.connectionStatus !== CarConnectionState.Connected &&
      this.connectionStatus !== CarConnectionState.Connecting &&
      this.connectionStatus !== CarConnectionState.Disconnecting;
  }

  private updateThrottle(event: PointerEvent): void {
    event.preventDefault();

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const centerY = rect.top + rect.height / 2;
    const deltaY = event.clientY - centerY;

    const half = rect.height / 2;
    const normalized = this.clamp(-deltaY / half, -1, 1);

    this.throttleValue = Math.round(normalized * 100);

    this.emitControlState();
  }

  private updateSteering(event: PointerEvent): void {
    event.preventDefault();

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const deltaX = event.clientX - centerX;

    const half = rect.width / 2;
    const normalized = this.clamp(deltaX / half, -1, 1);

    this.steeringValue = Math.round(normalized * 100);

    this.emitControlState();
  }

  private emitControlState(forceSend = false): void {
    const state = this.getCurrentControlState();
    const payload = this.serializeControlState(state);

    this.lastCommand = this.getReadableState(state);
    this.lastPayload = payload;

    if (payload === this.lastEmittedPayload) {
      return;
    }

    const isNeutral = state.throttle === 0 && state.steering === 0 && !state.brake;
    const mustSendImmediately = forceSend || state.brake || isNeutral;

    this.sendPayloadWithThrottle(payload, mustSendImmediately);
  }

  private sendPayloadWithThrottle(payload: string, forceSend: boolean): void {
    const now = Date.now();
    const elapsed = now - this.lastPayloadSentAt;

    if (forceSend || elapsed >= PAYLOAD_EMIT_INTERVAL_MS) {
      this.clearPendingPayloadTimer();
      this.sendPayload(payload);
      return;
    }

    this.clearPendingPayloadTimer();

    const remainingTime = PAYLOAD_EMIT_INTERVAL_MS - elapsed;

    this.pendingPayloadTimer = setTimeout(() => {
      const currentState = this.getCurrentControlState();
      const currentPayload = this.serializeControlState(currentState);

      this.sendPayload(currentPayload);
      this.pendingPayloadTimer = null;
    }, remainingTime);
  }

  private sendPayload(payload: string): void {
    if (payload === this.lastEmittedPayload) {
      return;
    }

    if (this.connectionStatus !== CarConnectionState.Connected) {
      return;
    }

    this.lastEmittedPayload = payload;
    this.lastPayloadSentAt = Date.now();

    console.log('Payload ESP32:', payload);

    this.bleService.writeValue(payload).catch(error => {
      console.error('Error enviando payload BLE:', error);
    });
  }

  private clearPendingPayloadTimer(): void {
    if (!this.pendingPayloadTimer) {
      return;
    }

    clearTimeout(this.pendingPayloadTimer);
    this.pendingPayloadTimer = null;
  }

  private getCurrentControlState(): ControlState {
    return {
      powerMode: this.powerMode,
      throttle: this.throttleValue,
      steering: this.steeringValue,
      brake: this.brakeActive
    };
  }

  private getReadableState(state: ControlState): string {
    const powerMode = state.powerMode === PowerMode.Sport ? 'S' : 'N';

    if (state.brake) {
      return `Freno activo / ${powerMode}`;
    }

    if (state.throttle === 0 && state.steering === 0) {
      return `Neutro / ${powerMode}`;
    }

    const parts: string[] = [];

    if (state.throttle > 0) {
      parts.push(`Acc ${state.throttle}%`);
    }

    if (state.throttle < 0) {
      parts.push(`Ret ${Math.abs(state.throttle)}%`);
    }

    if (state.steering < 0) {
      parts.push(`Izq ${Math.abs(state.steering)}%`);
    }

    if (state.steering > 0) {
      parts.push(`Der ${state.steering}%`);
    }

    parts.push(powerMode);

    return parts.join(' + ');
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private serializeControlState(state: ControlState): string {
    const mode = state.powerMode === PowerMode.Sport ? 'S' : 'N';
    const brake = state.brake ? 1 : 0;

    return `${mode},${state.throttle},${state.steering},${brake}`;
  }
}