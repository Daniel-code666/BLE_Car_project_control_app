export enum PowerMode {
  Normal = 'normal',
  Sport = 'sport'
}

// export type CarConnectionState =
//   | 'disconnected'
//   | 'connecting'
//   | 'connected'
//   | 'error';
export enum CarConnectionState {
  Disconnected = 'disconnected',
  Disconnecting = 'disconnecting',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error'
}


export interface ControlState {
  powerMode: PowerMode;
  throttle: number;
  steering: number;
  brake: boolean;
}