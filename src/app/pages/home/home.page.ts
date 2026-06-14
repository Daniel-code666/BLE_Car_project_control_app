import { Component } from '@angular/core';
import { IonButton, IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
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

type PowerMode = 'normal' | 'sport';

interface ControlState {
  powerMode: PowerMode;
  throttle: number;
  steering: number;
}

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
  connectionStatus = 'Desconectado';
  lastCommand = 'Sin comandos';

  controlsReversed = false;
  powerMode: PowerMode = 'normal';

  throttleValue = 0;
  steeringValue = 0;

  private draggingThrottle = false;
  private draggingSteering = false;

  constructor() {
    addIcons({
      bluetooth,
      carSport,
      radioButtonOn,
      swapHorizontal,
      stopCircle,
      speedometer,
      flash,
      leaf
    });
  }

  connect(): void {
    this.connectionStatus = 'Conectando...';

    setTimeout(() => {
      this.connectionStatus = 'Conectado';
    }, 800);
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
    this.emitControlState();
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
    this.emitControlState();
  }

  stopAll(event?: Event): void {
    event?.preventDefault();

    this.draggingThrottle = false;
    this.draggingSteering = false;

    this.throttleValue = 0;
    this.steeringValue = 0;

    this.emitControlState();
  }

  getThrottleKnobPosition(): string {
    /**
     * throttleValue:
     *  100  => arriba
     *    0  => centro
     * -100  => abajo
     */
    const maxOffset = 72;
    const offset = -(this.throttleValue / 100) * maxOffset;

    return `translate(-50%, calc(-50% + ${offset}px))`;
  }

  getSteeringKnobPosition(): string {
    /**
     * steeringValue:
     * -100 => izquierda
     *    0 => centro
     *  100 => derecha
     */
    const maxOffset = 72;
    const offset = (this.steeringValue / 100) * maxOffset;

    return `translate(calc(-50% + ${offset}px), -50%)`;
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

  private emitControlState(): void {
    const state: ControlState = {
      powerMode: this.powerMode,
      throttle: this.throttleValue,
      steering: this.steeringValue
    };

    this.lastCommand = this.getReadableState(state);

    console.log('Estado control:', state);

    /**
     * Más adelante esto se enviará por BLE.
     *
     * Ejemplo recomendado para ESP32:
     * {"p":"sport","t":75,"s":-40}
     *
     * p = power mode
     * t = throttle
     * s = steering
     */
  }

  private getReadableState(state: ControlState): string {
    if (state.throttle === 0 && state.steering === 0) {
      return `Neutro / ${state.powerMode}`;
    }

    const parts: string[] = [];

    if (state.throttle > 0) {
      parts.push(`Acelerar ${state.throttle}%`);
    }

    if (state.throttle < 0) {
      parts.push(`Retroceder ${Math.abs(state.throttle)}%`);
    }

    if (state.steering < 0) {
      parts.push(`Izquierda ${Math.abs(state.steering)}%`);
    }

    if (state.steering > 0) {
      parts.push(`Derecha ${state.steering}%`);
    }

    parts.push(state.powerMode);

    return parts.join(' + ');
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}