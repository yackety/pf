export interface DashboardStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalAccounts: number;
  accountsByPlatform: PlatformCount[];
}

export interface PlatformCount {
  platform: string;
  count: number;
}
