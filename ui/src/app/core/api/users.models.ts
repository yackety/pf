export interface User {
  id: number;
  username: string;
  role: 'Admin' | 'Operator';
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: 'Admin' | 'Operator';
}

export interface UpdateUserRequest {
  role?: 'Admin' | 'Operator';
  isActive?: boolean;
  password?: string;
}
