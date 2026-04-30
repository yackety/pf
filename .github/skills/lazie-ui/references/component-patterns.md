# Component Patterns — Lazie UI

Ready-to-use patterns for common UI elements. Copy and adapt.

---

## ThemeService

Persists the user's preference in `localStorage` and applies/removes the `dark` class on `<html>`. All Tailwind color tokens resolve automatically — no `dark:` prefix needed for color utilities.

```typescript
// core/theme/theme.service.ts
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'lazie-theme';
  readonly isDark = signal(this.#loadPreference());

  constructor() {
    // Apply theme immediately on service init (runs before first render)
    effect(() => {
      document.documentElement.classList.toggle('dark', this.isDark());
      localStorage.setItem(this.STORAGE_KEY, this.isDark() ? 'dark' : 'light');
    });
  }

  toggle() {
    this.isDark.update(v => !v);
  }

  setDark(dark: boolean) {
    this.isDark.set(dark);
  }

  #loadPreference(): boolean {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) return stored === 'dark';
    // Fall back to OS preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
```

Bootstrap the service in `app.config.ts` so it runs before the first render:

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    // Eagerly init ThemeService so dark class is applied before paint
    { provide: APP_INITIALIZER, useFactory: () => () => inject(ThemeService), multi: true },
  ],
};
```

---

## Theme Toggle Button

Inline component — drop into the shell top bar or any toolbar.

```typescript
// shared/components/theme-toggle/theme-toggle.component.ts
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="theme.toggle()"
      [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
      [attr.aria-pressed]="theme.isDark()"
      class="w-10 h-10 rounded-full flex items-center justify-center
             text-on-surface-variant
             hover:bg-surface-container-high
             focus-visible:ring-2 focus-visible:ring-primary
             transition-all duration-200 hover:scale-[1.02]"
    >
      @if (theme.isDark()) {
        <i class="fa-solid fa-sun text-lg" aria-hidden="true"></i>
      } @else {
        <i class="fa-solid fa-moon text-lg" aria-hidden="true"></i>
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
}
```

Add to the shell top bar next to the logout button:

```html
<app-theme-toggle />
```

---

## Dark-mode aware shadows

Use `dark:` prefix only for shadow and ring utilities — colors auto-switch via CSS vars:

```html
<!-- Card -->
<div class="shadow-card dark:shadow-card-dark hover:shadow-elevated dark:hover:shadow-elevated-dark
            bg-surface-container-lowest rounded-xl p-6 transition-shadow duration-200">
```

---

## Shell Layout

```typescript
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen bg-surface overflow-hidden">
      <!-- Sidebar -->
      <aside
        class="flex flex-col w-64 bg-surface-container shrink-0 transition-all duration-200"
        aria-label="Main navigation"
      >
        <!-- Logo -->
        <div class="flex items-center gap-3 px-6 py-5 border-b border-outline-variant">
          <img ngSrc="/lazie_logo.png" width="96" height="28" alt="Lazie" priority />
        </div>
        <!-- Nav -->
        <nav class="flex-1 overflow-y-auto py-4 px-3">
          @for (item of navItems; track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-primary/10 text-primary font-semibold"
              class="flex items-center gap-3 px-4 py-2.5 rounded-full text-on-surface-variant
                     hover:bg-surface-container-high transition-colors duration-200 label-md mb-1"
              [attr.aria-current]="isActive(item.route) ? 'page' : null"
            >
              <i [class]="item.faIcon + ' w-5 text-center'" aria-hidden="true"></i>
              {{ item.label }}
            </a>
          }
        </nav>
      </aside>

      <!-- Main content -->
      <div class="flex flex-col flex-1 min-w-0">
        <!-- Top bar -->
        <header class="flex items-center justify-between px-6 h-16 bg-surface border-b border-outline-variant shrink-0">
          <h1 class="headline-md text-on-surface">{{ pageTitle() }}</h1>
          <div class="flex items-center gap-3">
            <span class="label-sm text-on-surface-variant">{{ username() }}</span>
            <button
              (click)="logout()"
              class="rounded-full px-4 py-2 label-md text-on-surface-variant
                     hover:bg-surface-container-high transition-all duration-200"
              type="button"
            >
              <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
              <span class="sr-only">Logout</span>
            </button>
          </div>
        </header>
        <!-- Router outlet -->
        <main class="flex-1 overflow-y-auto p-6" id="main-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly username = computed(() => this.#auth.currentUser()?.username ?? '');
  readonly pageTitle = signal('Dashboard');
  readonly navItems = NAV_ITEMS;

  isActive(route: string) {
    return this.#router.url.startsWith(route);
  }

  logout() {
    this.#auth.logout();
    this.#router.navigate(['/login']);
  }
}
```

---

## Status Badge Component

```typescript
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      [class]="badgeClass()"
      [attr.aria-label]="'Status: ' + status()"
      class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full label-sm font-medium"
    >
      <i [class]="iconClass()" aria-hidden="true"></i>
      {{ label() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<'online' | 'offline' | 'banned' | 'active' | 'suspended' | 'inactive'>();

  readonly badgeClass = computed(() => {
    const map: Record<string, string> = {
      online:    'bg-green-100 text-green-800',
      active:    'bg-green-100 text-green-800',
      offline:   'bg-surface-container-high text-on-surface-variant',
      inactive:  'bg-surface-container-high text-on-surface-variant',
      suspended: 'bg-yellow-100 text-yellow-800',
      banned:    'bg-error-container text-on-error-container',
    };
    return map[this.status()] ?? 'bg-surface-container text-on-surface-variant';
  });

  readonly iconClass = computed(() => {
    const map: Record<string, string> = {
      online:    'fa-solid fa-circle text-green-500',
      active:    'fa-solid fa-circle text-green-500',
      offline:   'fa-solid fa-circle text-gray-400',
      inactive:  'fa-solid fa-circle text-gray-400',
      suspended: 'fa-solid fa-triangle-exclamation text-yellow-600',
      banned:    'fa-solid fa-ban text-error',
    };
    return map[this.status()] ?? 'fa-solid fa-circle';
  });

  readonly label = computed(() =>
    this.status().charAt(0).toUpperCase() + this.status().slice(1)
  );
}
```

---

## Platform Icon Component

```typescript
@Component({
  selector: 'app-platform-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <i [class]="iconClass()" aria-hidden="true" [title]="platform()"></i>
  `,
})
export class PlatformIconComponent {
  readonly platform = input.required<string>();

  readonly iconClass = computed(() => {
    const map: Record<string, string> = {
      facebook:  'fa-brands fa-facebook text-blue-600',
      tiktok:    'fa-brands fa-tiktok text-on-surface',
      google:    'fa-brands fa-google text-red-500',
      youtube:   'fa-brands fa-youtube text-red-600',
      instagram: 'fa-brands fa-instagram text-pink-600',
      twitter:   'fa-brands fa-x-twitter text-on-surface',
    };
    return map[this.platform().toLowerCase()] ?? 'fa-solid fa-globe text-on-surface-variant';
  });
}
```

---

## Confirm Dialog

```typescript
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-surface-dim/60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="dialogTitleId"
      (keydown.escape)="cancel.emit()"
    >
      <div class="bg-surface-container-lowest rounded-xl shadow-elevated p-8 w-full max-w-md mx-4">
        <h2 [id]="dialogTitleId" class="headline-md text-on-surface mb-3">{{ title() }}</h2>
        <p class="body-md text-on-surface-variant mb-8">{{ message() }}</p>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            (click)="cancel.emit()"
            class="rounded-full px-6 py-2.5 label-md text-on-surface-variant
                   border border-outline hover:bg-surface-container-high
                   transition-all duration-200 hover:scale-[1.02]"
          >
            Cancel
          </button>
          <button
            type="button"
            (click)="confirm.emit()"
            class="rounded-full px-6 py-2.5 label-md text-on-primary
                   bg-primary hover:bg-primary-container
                   transition-all duration-200 hover:scale-[1.02]"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent implements OnInit {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly confirm = output<void>();
  readonly cancel = output<void>();

  readonly dialogTitleId = `dialog-title-${Math.random().toString(36).slice(2)}`;

  ngOnInit() {
    // Trap focus — in a real implementation use a FocusTrapDirective
    document.getElementById(this.dialogTitleId)?.closest('[role="dialog"]')
      ?.querySelector<HTMLElement>('button')?.focus();
  }
}
```

---

## Dashboard Stats Card

```typescript
@Component({
  selector: 'app-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-surface-container-lowest rounded-xl shadow-card p-6 flex items-center gap-5
                hover:shadow-elevated transition-shadow duration-200">
      <div class="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <i [class]="icon() + ' text-primary text-xl'" aria-hidden="true"></i>
      </div>
      <div>
        <p class="label-sm text-on-surface-variant uppercase tracking-wide">{{ label() }}</p>
        <p class="headline-md text-on-surface mt-0.5">{{ value() }}</p>
      </div>
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input.required<string>(); // FA class e.g. 'fa-solid fa-mobile-screen'
}
```

---

## Device List Row (table pattern)

```html
<!-- Inside a paginated table component -->
<table class="w-full text-left" aria-label="Devices">
  <thead>
    <tr class="bg-surface-container-high">
      <th scope="col" class="px-4 py-3 label-md text-on-surface-variant rounded-tl-lg">Model</th>
      <th scope="col" class="px-4 py-3 label-md text-on-surface-variant">Platform</th>
      <th scope="col" class="px-4 py-3 label-md text-on-surface-variant">State</th>
      <th scope="col" class="px-4 py-3 label-md text-on-surface-variant">Last Seen</th>
      <th scope="col" class="px-4 py-3 label-md text-on-surface-variant rounded-tr-lg">Accounts</th>
    </tr>
  </thead>
  <tbody>
    @for (device of devices(); track device.udid) {
      <tr
        class="border-t border-outline-variant hover:bg-surface-container-high
               cursor-pointer transition-colors duration-150"
        (click)="navigateToDevice(device.udid)"
        (keydown.enter)="navigateToDevice(device.udid)"
        tabindex="0"
        [attr.aria-label]="'View device ' + device.model"
      >
        <td class="px-4 py-3 body-md text-on-surface font-medium">{{ device.model }}</td>
        <td class="px-4 py-3">
          <app-platform-icon [platform]="device.platform" />
        </td>
        <td class="px-4 py-3">
          <app-status-badge [status]="device.state === 'device' ? 'online' : 'offline'" />
        </td>
        <td class="px-4 py-3 label-sm text-on-surface-variant">
          {{ device.lastSeenAt | date:'short' }}
        </td>
        <td class="px-4 py-3 label-md text-on-surface">{{ device.accountCount }}</td>
      </tr>
    }
  </tbody>
</table>
```

---

## Login Page

```typescript
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-surface flex items-center justify-center p-4">
      <div class="bg-surface-container-lowest rounded-xl shadow-elevated p-10 w-full max-w-sm">
        <!-- Logo -->
        <div class="flex justify-center mb-8">
          <img ngSrc="/lazie_logo.png" width="120" height="36" alt="Lazie" priority />
        </div>

        <h1 class="headline-md text-on-surface text-center mb-6">Sign in</h1>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <!-- Username -->
          <div class="mb-4">
            <label for="username" class="block label-md text-on-surface-variant mb-1.5">
              Username
            </label>
            <input
              id="username"
              type="text"
              formControlName="username"
              autocomplete="username"
              class="w-full rounded-full border border-outline px-5 py-3 body-md text-on-surface
                     bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     transition-all duration-200"
              aria-describedby="username-error"
              [attr.aria-invalid]="form.controls.username.invalid && form.controls.username.touched"
            />
            @if (form.controls.username.invalid && form.controls.username.touched) {
              <span id="username-error" class="label-sm text-error mt-1 block" role="alert">
                Username is required
              </span>
            }
          </div>

          <!-- Password -->
          <div class="mb-6">
            <label for="password" class="block label-md text-on-surface-variant mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              class="w-full rounded-full border border-outline px-5 py-3 body-md text-on-surface
                     bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     transition-all duration-200"
            />
          </div>

          @if (error()) {
            <div class="bg-error-container text-on-error-container rounded-lg px-4 py-3 label-md mb-4" role="alert">
              {{ error() }}
            </div>
          }

          <button
            type="submit"
            [disabled]="isLoading()"
            class="w-full rounded-full bg-primary text-on-primary label-md py-3
                   hover:bg-primary-container hover:scale-[1.02]
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
                   transition-all duration-200"
          >
            @if (isLoading()) {
              <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true"></i>
            }
            Sign in
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  readonly #fb = inject(FormBuilder);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);

  readonly form = this.#fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  onSubmit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.isLoading.set(true);
    this.error.set(null);

    const { username, password } = this.form.getRawValue();
    this.#auth.login(username!, password!).subscribe({
      next: () => this.#router.navigate(['/dashboard']),
      error: () => {
        this.error.set('Invalid username or password.');
        this.isLoading.set(false);
      },
    });
  }
}
```

---

## nav-items.ts

```typescript
export interface NavItem {
  label: string;
  route: string;
  faIcon: string;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',  route: '/dashboard',     faIcon: 'fa-solid fa-gauge-high' },
  { label: 'Devices',    route: '/devices',        faIcon: 'fa-solid fa-mobile-screen' },
  { label: 'Accounts',   route: '/accounts',       faIcon: 'fa-solid fa-users' },
  { label: 'Users',      route: '/admin/users',    faIcon: 'fa-solid fa-user-shield', adminOnly: true },
];
```
