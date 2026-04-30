---
name: lazie-ui
description: "Use when creating, editing, or reviewing any file inside ui/. Implements the Lazie Angular 21 management dashboard: standalone components, Tailwind CSS v4, Font Awesome CDN, Angular Signals, OnPush, reactive forms, SignalR, JWT auth. Use for: generating components, services, guards, interceptors, routes, templates, Tailwind config, index.html setup, design token mapping, dark/light theme toggle, ThemeService, accessibility fixes."
argument-hint: "component name, feature, or task description"
---

# Lazie UI — Angular 21 Management Dashboard

## What This Skill Produces

Production-ready Angular 21 standalone components and services for the Lazie PhoneFarm management dashboard, following the "relaxed productivity" brand, Tailwind CSS v4 utility styling, and strict Angular best practices.

## When to Use

- Creating or editing any file under `ui/`
- Generating a new component, service, guard, interceptor, or route
- Writing templates with Tailwind classes and Font Awesome icons
- Setting up `tailwind.config.ts`, `index.html`, or `styles.css`
- Implementing auth flow, SignalR integration, or API services
- Implementing or modifying the light/dark theme system
- Fixing accessibility (AXE / WCAG AA) issues

---

## Quick Reference

| Topic | Reference |
|---|---|
| Design tokens (colors, typography, spacing, radius, dark palette, CSS vars) | [./references/design-tokens.md](./references/design-tokens.md) |
| Angular rules & patterns (signals, OnPush, forms, etc.) | [./references/angular-rules.md](./references/angular-rules.md) |
| Component code patterns (service, signal state, template) | [./references/component-patterns.md](./references/component-patterns.md) |

---

## Brand

| Asset | Path |
|---|---|
| Logo (horizontal) | `/ui/public/lazie_logo.png` — use via `NgOptimizedImage` |
| Favicon | `/ui/public/favicon.ico` |
| Square logo / PWA icon | `/ui/public/favicon-512x512.png` |
| Brand name | **Lazie** — capital L, lowercase rest; never ALL CAPS |

Brand personality: **relaxed productivity** — soft, rounded, approachable. Every UI decision should reinforce calm focus.

---

## Non-Negotiable Tech Rules

- **Tailwind CSS v4** via PostCSS — no Angular Material, no CSS frameworks
- **Light + dark theme** — all color tokens are CSS custom properties; toggling `dark` on `<html>` switches the full palette; use `dark:` prefix only for non-color utilities (shadows, rings)
- **`ThemeService`** — manages `dark` class on `<html>` + `localStorage` persistence + OS preference fallback; bootstrap via `APP_INITIALIZER`
- **Font Awesome 6 Free** via CDN `<link>` in `index.html` only — never install `@fortawesome/*`
- **Angular 21** standalone components — never write `standalone: true` (it is the default)
- **`ChangeDetectionStrategy.OnPush`** on every component — no exceptions
- **`inject()`** for DI — never constructor injection
- **`input()` / `output()`** functions — never `@Input()` / `@Output()` decorators
- **Native control flow** — `@if`, `@for`, `@switch`; never `*ngIf`, `*ngFor`
- **`[class]` bindings** — never `ngClass`; **`[style]` bindings** — never `ngStyle`
- **Strict TypeScript** — no `any` type; use `unknown` when uncertain
- **WCAG AA + AXE** — all components must pass; see accessibility rules below

---

## Font Awesome CDN (copy exactly)

Place in `ui/src/index.html` `<head>`:

```html
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
  integrity="sha512-Evv84Mr4kqVGRNSgIGL/F/aIDqQb7xQ2zZB7dPNs4GjMSjy6tnAuqMFQGI+uqKUMskOBMVlXoNmkGeULXW6A=="
  crossorigin="anonymous"
  referrerpolicy="no-referrer"
/>
```

Template usage — always add `aria-hidden="true"` on decorative icons:

```html
<i class="fa-brands fa-facebook" aria-hidden="true"></i>
<i class="fa-solid fa-mobile-screen" aria-hidden="true"></i>
<i class="fa-solid fa-circle text-green-500" aria-hidden="true"></i>
```

For meaningful icons, pair with a visually-hidden label:
```html
<i class="fa-solid fa-wifi" aria-hidden="true"></i>
<span class="sr-only">Online</span>
```

---

## Accessibility (mandatory)

- Must pass all AXE checks
- Must meet WCAG AA contrast ratios (use design token colors — they are pre-validated)
- All interactive elements keyboard-navigable with visible focus rings (`ring-2 ring-primary`)
- Semantic HTML: `<nav>`, `<main>`, `<header>`, `<button>`, `<table>` etc.
- All form inputs have associated `<label>`
- Modals trap focus and restore it on close
- `aria-live="polite"` on regions updated by SignalR events
- Decorative images: `alt=""`; informative images: descriptive `alt` text

---

## Project Structure (abbreviated)

```
ui/
├── public/
│   ├── lazie_logo.png
│   ├── favicon.ico
│   └── favicon-512x512.png
├── src/
│   ├── index.html              ← FA CDN + Google Fonts + viewport meta
│   ├── styles.css              ← @import "tailwindcss"; base overrides only
│   └── app/
│       ├── app.config.ts       ← provideRouter, provideHttpClient, provideAnimations
│       ├── app.routes.ts       ← lazy routes only
│       ├── core/
│       │   ├── auth/           ← auth.service, auth.interceptor, auth.guard
│       │   ├── api/            ← devices/accounts/agents/dashboard services
│       │   └── signalr/        ← device-hub.service
│       ├── shared/components/  ← status-badge, platform-icon, confirm-dialog, paginated-table
│       ├── layout/             ← shell.component, nav-items
│       └── features/           ← auth, dashboard, devices, accounts, admin (all lazy)
├── tailwind.config.ts
└── tsconfig.json               ← strict: true
```

---

## Routes

| Path | Guard | Notes |
|---|---|---|
| `/login` | Public | Redirect to `/dashboard` if authenticated |
| `/dashboard` | `authGuard` | Default after login |
| `/devices` | `authGuard` | |
| `/devices/:udid` | `authGuard` | |
| `/accounts` | `authGuard` | |
| `/admin/users` | `adminGuard` | Admin role only |
| `**` | — | Redirect → `/dashboard` |

All feature routes use `loadComponent` (lazy).

---

## Auth Flow

1. Login form → `POST /api/auth/login` → access token in `sessionStorage`, refresh token in HttpOnly cookie
2. `AuthInterceptor` adds `Authorization: Bearer {token}` to every request
3. On 401: auto-refresh via `POST /api/auth/refresh`, retry original request once
4. On refresh failure: clear `sessionStorage`, navigate to `/login`

---

## SignalR Signals (DeviceHubService)

```typescript
readonly deviceStateChanged: Signal<DeviceStateChangedEvent | undefined>;
readonly agentOnline: Signal<AgentEvent | undefined>;
readonly agentOffline: Signal<AgentEvent | undefined>;
readonly deviceConnected: Signal<DeviceConnectedEvent | undefined>;
readonly deviceDisconnected: Signal<{ udid: string } | undefined>;
```

Components use `effect()` to react and update local state — never re-fetch full lists on hub events.

---

## Do Not

- Install or import `@angular/material` or `@fortawesome/*`
- Use `NgModules`, `*ngIf`, `*ngFor`, `ngClass`, `ngStyle`
- Write `standalone: true` in decorators
- Use `@Input()`, `@Output()`, `@HostBinding()`, `@HostListener()`
- Use constructor injection or the `any` type
- Call `signal.mutate()`
- Call the Node.js agent API directly — all data flows through the .NET Core API
