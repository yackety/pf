import { inject, Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';
import type {
  AgentEvent,
  DeviceConnectedEvent,
  DeviceStateChangedEvent,
} from './device-hub.models';

@Injectable({ providedIn: 'root' })
export class DeviceHubService {
  readonly #auth = inject(AuthService);

  readonly deviceStateChanged = signal<DeviceStateChangedEvent | undefined>(undefined);
  readonly agentOnline = signal<AgentEvent | undefined>(undefined);
  readonly agentOffline = signal<AgentEvent | undefined>(undefined);
  readonly deviceConnected = signal<DeviceConnectedEvent | undefined>(undefined);
  readonly deviceDisconnected = signal<{ udid: string } | undefined>(undefined);

  #connection: signalR.HubConnection | undefined;

  connect(): void {
    if (this.#connection) return;

    this.#connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.signalrHub, {
        accessTokenFactory: () => this.#auth.getToken() ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.#connection.on('DeviceStateChanged', (ev: DeviceStateChangedEvent) =>
      this.deviceStateChanged.set(ev),
    );
    this.#connection.on('AgentOnline', (ev: AgentEvent) => this.agentOnline.set(ev));
    this.#connection.on('AgentOffline', (ev: AgentEvent) => this.agentOffline.set(ev));
    this.#connection.on('DeviceConnected', (ev: DeviceConnectedEvent) =>
      this.deviceConnected.set(ev),
    );
    this.#connection.on('DeviceDisconnected', (ev: { udid: string }) =>
      this.deviceDisconnected.set(ev),
    );

    this.#connection.start().catch(err =>
      console.error('[DeviceHub] Connection failed:', err),
    );
  }

  disconnect(): void {
    this.#connection?.stop();
    this.#connection = undefined;
  }
}
