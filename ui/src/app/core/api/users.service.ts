import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { CreateUserRequest, UpdateUserRequest, User } from './users.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  readonly #http = inject(HttpClient);
  readonly #base = `${environment.apiBase}/users`;

  getAll() {
    return this.#http.get<User[]>(this.#base);
  }

  create(req: CreateUserRequest) {
    return this.#http.post<User>(this.#base, req);
  }

  update(id: number, req: UpdateUserRequest) {
    return this.#http.put<User>(`${this.#base}/${id}`, req);
  }
}
