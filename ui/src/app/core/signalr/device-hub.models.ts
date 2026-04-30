export interface DeviceStateChangedEvent {
  udid: string;
  state: string;
  agentId: string;
}

export interface AgentEvent {
  agentId: string;
}

export interface DeviceConnectedEvent {
  udid: string;
  agentId: string;
  model: string;
}
