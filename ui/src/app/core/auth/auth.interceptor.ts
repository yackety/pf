import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, Observable, switchMap, take, throwError } from 'rxjs';
import type { AuthTokens } from './auth.models';
import { AuthService } from './auth.service';

// Shared state for concurrent refresh deduplication
let isRefreshing = false;
const refreshToken$ = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Never intercept the refresh or login endpoints to avoid infinite loops
  if (isAuthEndpoint(req.url)) {
    return next(req);
  }

  const token = auth.getToken();
  const authedReq = token ? addToken(req, token) : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        return handle401(req, next, auth, router);
      }
      return throwError(() => err);
    }),
  );
};

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  if (isRefreshing) {
    // Queue behind the in-progress refresh
    return refreshToken$.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap(token => next(addToken(req, token))),
    );
  }

  isRefreshing = true;
  refreshToken$.next(null);

  let refreshObservable: Observable<AuthTokens>;
  try {
    refreshObservable = auth.refresh();
  } catch {
    isRefreshing = false;
    auth.clearSession();
    router.navigate(['/login']);
    return throwError(() => new Error('No refresh token.'));
  }

  return refreshObservable.pipe(
    switchMap(res => {
      isRefreshing = false;
      refreshToken$.next(res.accessToken);
      return next(addToken(req, res.accessToken));
    }),
    catchError(err => {
      isRefreshing = false;
      refreshToken$.next(null);
      auth.clearSession();
      router.navigate(['/login']);
      return throwError(() => err);
    }),
  );
}

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isAuthEndpoint(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');
}
