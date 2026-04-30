export interface Account {
  id: number;
  platformId: number;
  platformName: string;
  username: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  activeDeviceCount: number;
}

export interface AccountFilterParams {
  platformId?: number;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateAccountRequest {
  platformId: number;
  username: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface UpdateAccountRequest {
  platformId?: number;
  username?: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
  notes?: string | null;
}

export interface Platform {
  id: number;
  name: string;
  displayName: string;
}
