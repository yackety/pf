import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AuthTokens, LoginRequest, UserInfo } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #http = inject(HttpClient);
  private readonly TOKEN_KEY = 'lazie-access-token';
  private readonly USER_KEY = 'lazie-user';

  readonly currentUser = signal<UserInfo | null>(this.#loadUser());
  readonly isAuthenticated = signal(!!sessionStorage.getItem(this.TOKEN_KEY));

  login(req: LoginRequest) {
    return this.#http
      .post<AuthTokens & { user: UserInfo }>(`${environment.apiBase}/auth/login`, req)
      .pipe(
        tap(res => {
          sessionStorage.setItem(this.TOKEN_KEY, res.accessToken);
          sessionStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
          this.currentUser.set(res.user);
          this.isAuthenticated.set(true);
        }),
      );
  }

  refresh() {
    return this.#http
      .post<AuthTokens>(`${environment.apiBase}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap(res => {
          sessionStorage.setItem(this.TOKEN_KEY, res.accessToken);
        }),
      );
  }

  logout() {
    this.#http.post(`${environment.apiBase}/auth/logout`, {}, { withCredentials: true }).subscribe();
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'Admin';
  }

  #loadUser(): UserInfo | null {
    const raw = sessionStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserInfo;
    } catch {
      return null;
    }
  }
}
