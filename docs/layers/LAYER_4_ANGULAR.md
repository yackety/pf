# Layer 4 — Angular 21 Web UI

## Purpose

The Angular 21 SPA is the **remote management dashboard** for operators and administrators. It reads all data from the .NET Core API and never communicates directly with the agent or database. It supports real-time device status updates via SignalR.

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Angular 21 |
| State management | Angular Signals + `signal()` / `computed()` |
| Styling | Tailwind CSS v4 (PostCSS plugin) |
| Icons | Font Awesome 6 Free — CDN only (`<link>` in `index.html`) |
| HTTP | `HttpClient` with functional interceptors |
| Real-time | `@microsoft/signalr` client → .NET Core SignalR hub |
| Forms | Reactive Forms (`FormBuilder`) |
| Auth storage | `sessionStorage` (JWT access token) |
| Build | Angular CLI, standalone components |

## Styling Conventions

### Tailwind CSS
- Installed via `@tailwindcss/vite` (or PostCSS plugin) — **no Angular Material dependency**
- Utility-first classes used directly in component templates
- Custom design tokens defined in `tailwind.config.ts` (brand colours, sidebar width, etc.)
- Dark mode: `class` strategy — toggled by adding `dark` to `<html>`

### Font Awesome
Loaded via CDN only — **not** installed as an npm package:

```html
<!-- index.html -->
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
  integrity="sha512-..."
  crossorigin="anonymous"
  referrerpolicy="no-referrer"
/>
```

Used inline in templates:
```html
<i class="fa-brands fa-facebook"></i>
<i class="fa-solid fa-mobile-screen"></i>
<i class="fa-solid fa-circle text-green-500"></i>  <!-- online indicator -->
```

**Rule:** Never import `@fortawesome/*` npm packages. CDN link is the only source.

## Project Structure

```
phonefarm-ui/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── auth/
│   │   │   │   ├── auth.service.ts          — login, logout, token storage
│   │   │   │   ├── auth.interceptor.ts      — attach Bearer token to requests
│   │   │   │   └── auth.guard.ts            — route guard (isLoggedIn, isAdmin)
│   │   │   ├── api/
│   │   │   │   ├── devices.service.ts       — typed wrappers for /api/devices/*
│   │   │   │   ├── accounts.service.ts      — typed wrappers for /api/accounts/*
│   │   │   │   ├── agents.service.ts        — typed wrappers for /api/agents/*
│   │   │   │   └── dashboard.service.ts     — /api/dashboard/stats
│   │   │   └── signalr/
│   │   │       └── device-hub.service.ts    — SignalR connection, event streams as Signals
│   │   │
│   │   ├── shared/
│   │   │   └── components/
│   │   │       ├── status-badge/            — online/offline/banned badges (Tailwind + FA circle icon)
│   │   │       ├── platform-icon/           — FA brand icons (fa-brands fa-facebook, fa-tiktok, …)
│   │   │       ├── confirm-dialog/          — reusable confirmation modal (Tailwind overlay)
│   │   │       └── paginated-table/         — generic sortable/paginated table (Tailwind styled)
│   │   │
│   │   ├── layout/
│   │   │   ├── shell.component.ts           — app shell with collapsible sidebar + top bar (Tailwind flex layout)
│   │   │   └── nav-items.ts                 — sidebar nav config with FA icon class per item
│   │   │
│   │   └── features/
│   │       ├── auth/
│   │       │   └── login/                   — login page (username + password form)
│   │       │
│   │       ├── dashboard/
│   │       │   └── dashboard.component.ts   — stats cards + live device grid overview
│   │       │
│   │       ├── devices/
│   │       │   ├── device-list/             — filterable, sortable, paginated table
│   │       │   └── device-detail/           — tabs: Info | Accounts | Session Log
│   │       │
│   │       ├── accounts/
│   │       │   ├── account-list/            — filter by platform/status, search
│   │       │   └── account-form/            — create / edit account dialog
│   │       │
│   │       └── admin/
│   │           └── users/                   — user list + create/edit (admin only)
│   │
│   ├── environments/
│   │   ├── environment.ts                   — { apiBaseUrl, signalrHubUrl }
│   │   └── environment.prod.ts
│   └── main.ts
```

## Routes

| Path | Component | Guard |
|---|---|---|
| `/login` | `LoginComponent` | Public |
| `/dashboard` | `DashboardComponent` | `authGuard` |
| `/devices` | `DeviceListComponent` | `authGuard` |
| `/devices/:udid` | `DeviceDetailComponent` | `authGuard` |
| `/accounts` | `AccountListComponent` | `authGuard` |
| `/admin/users` | `UsersComponent` | `adminGuard` |

## Key UI Features

### Dashboard
- Summary cards: Total Devices, Online Now, Offline, Agents Online
- Per-platform account count breakdown (bar chart or chip list)
- Device grid: compact tiles showing model, state badge, agent label
- Tiles update live via SignalR — no page refresh needed

### Device List
- Columns: UDID, Platform, Model, OS, State, Agent, Last Seen, Tags, Accounts count
- Filters: State (online/offline/all), Platform (android/ios), Agent, Tag search
- Click row → Device Detail

### Device Detail
Three tabs:

| Tab | Content |
|---|---|
| **Info** | All device properties from DB (model, OS, SDK, IPs, raw props collapsible JSON) |
| **Accounts** | List of currently linked accounts with platform icon + status badge; button to add/remove |
| **Session Log** | Paginated timeline of connect/disconnect/state-change events |

- "Send Command" button → opens dialog → calls `POST /api/devices/{udid}/action` (screenshot, etc.)

### Account List
- Columns: Platform icon, Username, Display Name, Status, Assigned Devices count, Updated At
- Filters: Platform dropdown, Status dropdown, text search
- FAB / button → opens Account Form dialog to create new account

### Account Form (dialog)
- Fields: Platform (dropdown), Username, Display Name, Email, Phone, Status, Notes
- Validation: Username required; Email format if provided

### Account Detail (inline or expand)
- Shows which devices this account is currently assigned to
- Link to each device's detail page

## Real-Time via SignalR

`DeviceHubService` maintains a persistent SignalR connection and exposes Angular Signals:

```typescript
// device-hub.service.ts (sketch)
deviceStateChanged = toSignal(this.stateChangedSubject.asObservable());
agentOnline        = toSignal(this.agentOnlineSubject.asObservable());
agentOffline       = toSignal(this.agentOfflineSubject.asObservable());
```

Components subscribe to these signals to update device tiles/rows in place without re-fetching the full list.

## Auth Flow

1. User submits login form → `POST /api/auth/login`
2. Access token stored in `sessionStorage`; refresh token in HttpOnly cookie (set by server)
3. `AuthInterceptor` attaches `Authorization: Bearer {token}` to every API request
4. On 401 response: interceptor calls `POST /api/auth/refresh` → retries original request
5. On refresh failure (e.g. expired): redirect to `/login`

## Environment Config

```typescript
// environment.ts
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5000',
  signalrHubUrl: 'http://localhost:5000/hubs/devices',
};
```
