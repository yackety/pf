import {
  APP_INITIALIZER,
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { ThemeService } from './core/theme/theme.service';
import { DeviceHubService } from './core/signalr/device-hub.service';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    // Apply theme before first paint
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => inject(ThemeService),
      multi: true,
    },
    // Start SignalR hub if already authenticated (page refresh)
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {
        const auth = inject(AuthService);
        const hub = inject(DeviceHubService);
        if (auth.isAuthenticated()) hub.connect();
      },
      multi: true,
    },
  ],
};

