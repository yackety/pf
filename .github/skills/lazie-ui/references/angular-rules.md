# Angular Rules — Lazie UI

Strict rules for all Angular 21 code in `ui/`. These are enforced — not suggestions.

---

## Components

### Decorator requirements
```typescript
@Component({
  selector: 'app-example',
  changeDetection: ChangeDetectionStrategy.OnPush,  // ALWAYS
  // standalone: true  ← DO NOT write this; it is the default in Angular 20+
  template: `...`,    // or templateUrl relative to the .ts file
})
```

### Inputs & outputs — use functions, not decorators
```typescript
// ✅ Correct
readonly device = input.required<Device>();
readonly udid = input<string>('');
readonly selected = output<Device>();

// ❌ Wrong
@Input() device!: Device;
@Output() selected = new EventEmitter<Device>();
```

### Host bindings — use `host` object, not decorators
```typescript
// ✅ Correct
@Component({
  host: { '[class.active]': 'isActive()', '(click)': 'onClick()' },
})

// ❌ Wrong
@HostBinding('class.active') isActive = false;
@HostListener('click') onClick() {}
```

### Dependency injection — use `inject()`, not constructor
```typescript
// ✅ Correct
export class DeviceListComponent {
  readonly #devices = inject(DevicesService);
  readonly #router = inject(Router);
}

// ❌ Wrong
constructor(private devices: DevicesService) {}
```

---

## Templates

### Control flow — native syntax only
```html
<!-- ✅ Correct -->
@if (isLoading()) {
  <app-spinner />
} @else {
  <app-device-list [devices]="devices()" />
}

@for (device of devices(); track device.udid) {
  <app-device-row [device]="device" />
}

@switch (device().state) {
  @case ('device') { <span class="text-green-600">Online</span> }
  @case ('disconnected') { <span class="text-gray-400">Offline</span> }
}

<!-- ❌ Wrong -->
<div *ngIf="isLoading">...</div>
<div *ngFor="let d of devices">...</div>
```

### Class and style bindings — never `ngClass` / `ngStyle`
```html
<!-- ✅ Correct -->
<div [class]="isActive() ? 'bg-primary text-on-primary' : 'bg-surface'">
<div [class.hidden]="!visible()">
<div [style.width.px]="width()">

<!-- ❌ Wrong -->
<div [ngClass]="{ active: isActive }">
<div [ngStyle]="{ width: width + 'px' }">
```

### Static images — use `NgOptimizedImage`
```typescript
import { NgOptimizedImage } from '@angular/common';

// In template:
<img ngSrc="/lazie_logo.png" width="120" height="32" alt="Lazie" priority />
// NgOptimizedImage does NOT work for inline base64 images
```

### No globals in templates
```typescript
// ❌ Wrong in template: {{ new Date() | date }}

// ✅ Correct — compute in component class
readonly now = signal(new Date());
// template: {{ now() | date }}
```

### Observables — use async pipe in templates
```html
<div>{{ devices$ | async | json }}</div>
```

---

## Signals & State

### Local state — always signals
```typescript
readonly isLoading = signal(false);
readonly devices = signal<Device[]>([]);
readonly filter = signal('');

// Derived state — always computed()
readonly filteredDevices = computed(() =>
  this.devices().filter(d =>
    d.model.toLowerCase().includes(this.filter().toLowerCase())
  )
);
```

### Updating signals
```typescript
// ✅ Correct
this.devices.set([...newDevices]);
this.devices.update(prev => [...prev, newDevice]);

// ❌ Wrong — mutate does not exist in Angular 21
this.devices.mutate(d => d.push(newDevice));
```

### Converting observables to signals
```typescript
import { toSignal } from '@angular/core/rxjs-interop';

readonly devices = toSignal(this.devicesService.getDevices(), { initialValue: [] });
```

### Reacting to signal changes — use `effect()`
```typescript
constructor() {
  effect(() => {
    const event = this.hubService.deviceStateChanged();
    if (event) {
      this.devices.update(list =>
        list.map(d => d.udid === event.udid ? { ...d, state: event.state } : d)
      );
    }
  });
}
```

---

## Services

```typescript
@Injectable({ providedIn: 'root' })   // always root for singletons
export class DevicesService {
  readonly #http = inject(HttpClient);
  readonly #base = `${environment.apiBaseUrl}/api/devices`;

  getDevices(params: DeviceListParams) {
    return this.#http.get<PagedResult<Device>>(this.#base, { params: { ...params } });
  }

  getDevice(udid: string) {
    return this.#http.get<Device>(`${this.#base}/${udid}`);
  }

  updateDevice(udid: string, patch: Partial<Device>) {
    return this.#http.patch<Device>(`${this.#base}/${udid}`, patch);
  }
}
```

---

## Routing

All feature routes use `loadComponent` (lazy):

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'devices', loadComponent: () => import('./features/devices/device-list/device-list.component').then(m => m.DeviceListComponent) },
      { path: 'devices/:udid', loadComponent: () => import('./features/devices/device-detail/device-detail.component').then(m => m.DeviceDetailComponent) },
      { path: 'accounts', loadComponent: () => import('./features/accounts/account-list/account-list.component').then(m => m.AccountListComponent) },
      { path: 'admin/users', loadComponent: () => import('./features/admin/users/users.component').then(m => m.UsersComponent), canActivate: [adminGuard] },
    ],
  },
  { path: '**', redirectTo: '/dashboard' },
];
```

---

## Forms (Reactive only)

```typescript
readonly #fb = inject(FormBuilder);

readonly form = this.#fb.group({
  username: ['', [Validators.required]],
  email: ['', [Validators.email]],
  platform: [null as number | null, Validators.required],
});

// Submit
onSubmit() {
  if (this.form.invalid) return;
  const value = this.form.getRawValue();
  // ...
}
```

Template:
```html
<form [formGroup]="form" (ngSubmit)="onSubmit()">
  <label for="username" class="font-body label-md text-on-surface-variant">Username</label>
  <input
    id="username"
    formControlName="username"
    class="w-full rounded-full border border-outline px-4 py-3 focus:ring-2 focus:ring-primary/30 focus:border-primary"
    aria-describedby="username-error"
  />
  @if (form.controls.username.invalid && form.controls.username.touched) {
    <span id="username-error" class="text-error label-sm" role="alert">Username is required</span>
  }
</form>
```

---

## HTTP Interceptors

```typescript
// auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = sessionStorage.getItem('access_token');
  const auth = inject(AuthService);

  const cloned = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(cloned).pipe(
    catchError(err => {
      if (err.status === 401) {
        return auth.refresh().pipe(switchMap(() => next(cloned)));
      }
      return throwError(() => err);
    })
  );
};
```

Register in `app.config.ts`:
```typescript
provideHttpClient(withInterceptors([authInterceptor]))
```

---

## TypeScript

- `strict: true` in `tsconfig.json`
- No `any` — use `unknown` and narrow with type guards
- Use `#` prefix for private class members (ES private fields)
- Prefer type inference; annotate only when inference is wrong or unclear
- Use `satisfies` operator for config objects

---

## Accessibility Checklist (per component)

- [ ] All interactive elements reachable by keyboard (Tab order logical)
- [ ] Focus indicator visible (`ring-2 ring-primary` or equivalent)
- [ ] Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- [ ] All form inputs have `<label>` with matching `for`/`id`
- [ ] Error messages associated via `aria-describedby`
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Meaningful icons have adjacent `sr-only` text
- [ ] Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trapped
- [ ] Live regions: `aria-live="polite"` for non-urgent updates
- [ ] Images: descriptive `alt` or `alt=""` for decorative
