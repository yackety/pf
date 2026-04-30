export interface Device {
  udid: string;
  agentId: number;
  agentName: string;
  platform: string;
  state: string;
  model: string | null;
  manufacturer: string | null;
  osVersion: string | null;
  sdkVersion: string | null;
  ipAddresses: string | null;
  displayName: string | null;
  tags: string | null;
  notes: string | null;
  rawProps: string | null;
  lastSeenAt: string;
  createdAt: string;
}

export interface DeviceAccount {
  deviceAccountId: number;
  accountId: number;
  username: string;
  displayName: string | null;
  platformId: number;
  platformName: string;
  status: string;
  assignedAt: string;
}

export interface DeviceSessionLog {
  id: number;
  udid: string;
  event: string;
  detail: string | null;
  occurredAt: string;
}

export interface DeviceFilterParams {
  state?: string;
  platform?: string;
  agentId?: number;
  tag?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DeviceMeta {
  tags: string | null;
  notes: string | null;
}

export interface DeviceActionRequest {
  type: string;
  params?: Record<string, unknown>;
}
