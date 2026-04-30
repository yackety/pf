import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.getToken();
  const authedReq = token ? addToken(req, token) : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        return auth.refresh().pipe(
          switchMap(res => {
            return next(addToken(req, res.accessToken));
          }),
          catchError(() => {
            auth.logout();
            router.navigate(['/login']);
            return throwError(() => err);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const withCredentialsInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => next(req.clone({ withCredentials: true }));
