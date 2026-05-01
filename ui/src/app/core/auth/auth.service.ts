import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AuthTokens, LoginRequest, UserInfo } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #http = inject(HttpClient);
  private readonly TOKEN_KEY = 'lazie-access-token';
  private readonly REFRESH_KEY = 'lazie-refresh-token';
  private readonly USER_KEY = 'lazie-user';

  readonly currentUser = signal<UserInfo | null>(this.#loadUser());
  readonly isAuthenticated = signal(!!sessionStorage.getItem(this.TOKEN_KEY));

  login(req: LoginRequest) {
    return this.#http
      .post<AuthTokens & { user: UserInfo }>(`${environment.apiBase}/auth/login`, req)
      .pipe(
        tap(res => {
          sessionStorage.setItem(this.TOKEN_KEY, res.accessToken);
          sessionStorage.setItem(this.REFRESH_KEY, res.refreshToken);
          sessionStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
          this.currentUser.set(res.user);
          this.isAuthenticated.set(true);
        }),
      );
  }

  refresh() {
    const refreshToken = sessionStorage.getItem(this.REFRESH_KEY);
    if (!refreshToken) {
      this.clearSession();
      throw new Error('No refresh token available.');
    }
    return this.#http
      .post<AuthTokens>(`${environment.apiBase}/auth/refresh`, { refreshToken })
      .pipe(
        tap(res => {
          sessionStorage.setItem(this.TOKEN_KEY, res.accessToken);
          sessionStorage.setItem(this.REFRESH_KEY, res.refreshToken);
        }),
      );
  }

  logout() {
    const refreshToken = sessionStorage.getItem(this.REFRESH_KEY);
    if (refreshToken) {
      this.#http
        .post(`${environment.apiBase}/auth/logout`, { refreshToken })
        .subscribe({ error: () => {} });
    }
    this.clearSession();
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'Admin';
  }

  clearSession(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
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
