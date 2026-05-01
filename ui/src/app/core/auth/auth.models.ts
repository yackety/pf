export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface UserInfo {
  id: number;
  username: string;
  role: 'Admin' | 'Operator';
}
