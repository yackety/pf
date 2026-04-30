# PhoneFarm — Copilot Instructions

## System Architecture (5 layers)

```
[Android/iOS Devices]
        ↓ ADB / WDA
[Node.js Agent]  ──upsert──→  [MSSQL Database]
        ↑  WS/HTTP                    ↑
[React Client]          [.NET Core 10 API]  ←→  [Angular 21 UI]
 (local, on-site)        (hosted, remote)         (browser)
```

| Layer | Folder | Role |
|---|---|---|
| 0 | `client/` | React local viewer — live stream + direct ADB control |
| 1 | `server/` | Node.js agent — ADB/WDA bridge; writes device data to DB |
| 2 | MSSQL | Central store — owned by agent writes, read by .NET API |
| 3 | `api/` | ASP.NET Core 10 — management API + SignalR hub |
| 4 | `ui/` | Angular 21 — remote management dashboard |

---

## Hard Rules (never violate)

- **Angular UI never contacts the Node.js agent or MSSQL directly.** All data goes through the .NET Core API.
- **Node.js agent only writes to DB** (upserts). It never reads application data from it.
- **React client (`client/`) is unchanged** — it remains a local ADB streaming viewer. Do not add API calls to it that belong in Angular.
- **Device control from Angular** uses the proxy pattern: Angular → `POST /api/devices/{udid}/action` → .NET API → Node.js agent.
- **.NET Core API never runs ADB commands** — it always delegates to the agent via HTTP proxy.
- **No Angular Material** in the Angular UI — use Tailwind CSS v4 utility classes only.
- **Font Awesome icons** in Angular via CDN `<link>` in `index.html` only — never install `@fortawesome/*` npm packages.

---

## Layer 0 — React Client (`client/`)

- Vite + React 18 + TypeScript
- Connects directly to Node.js agent WebSocket (`ws://localhost:11000`)
- Video decoded via **WebCodecs API** (`webcodecs_worker.worker.ts`) with tinyh264 fallback
- Touch/key/swipe control encoded as binary messages (`lib/control.ts`) sent over WS
- **Do not add** REST calls to the .NET Core API here

---

## Layer 1 — Node.js Agent (`server/`)

- Existing TypeScript/Node.js app — extend, do not rewrite
- DB writes use `mssql` or `tedious` — add a `DbService` singleton
- New config keys in `config.yaml`:
  ```yaml
  database:
    connectionString: "Server=...;Database=PhoneFarm;..."
  agent:
    id: "agent-office-01"
    host: "http://192.168.1.10:11000"
    heartbeatIntervalSeconds: 30
  ```
- Upsert `Devices` on every `DeviceTrackerEvent`; update `Agents.LastHeartbeatAt` every 30s

---

## Layer 2 — MSSQL Database

Key tables: `Agents`, `Devices`, `Platforms`, `SocialAccounts`, `DeviceAccounts`, `Users`, `DeviceSessionLog`

- `Devices.Udid` is the natural key (ADB serial / iOS UDID)
- `Devices.RawProps` stores full JSON descriptor snapshot
- `DeviceAccounts` is the many-to-many link between devices and social accounts
- `Devices.Tags` and `Devices.Notes` are operator-editable fields (never written by agent)

---

## Layer 3 — .NET Core API (`api/`)

**Solution:** `PhoneFarm.sln`  
**Projects:** `PhoneFarm.Domain`, `PhoneFarm.Infrastructure`, `PhoneFarm.Application`, `PhoneFarm.API`

- Framework: ASP.NET Core 10, EF Core 10, SignalR, JWT Bearer auth
- Roles: `Admin`, `Operator`
- Key endpoints:
  - `POST /api/auth/login` — JWT access + refresh token
  - `GET /api/devices` — paginated, filterable device list
  - `PATCH /api/devices/{udid}` — update tags/notes only
  - `POST /api/devices/{udid}/accounts/{accountId}` — link account
  - `POST /api/devices/{udid}/action` — proxy command to agent
  - `GET /api/accounts` — paginated account list
  - `POST /api/accounts` — create account
- SignalR hub at `/hubs/device` — push device state changes to Angular UI
- Agent proxy: lookup `Agents.Host` from DB → `HttpClient` → forward to agent → stream response back

---

## Layer 4 — Angular 21 UI (`ui/`)

- **Angular 21, standalone components, OnPush change detection**
- State: Angular Signals (`signal()`, `computed()`, `effect()`)
- Styling: Tailwind CSS v4 utility classes in templates
- Icons: Font Awesome 6 via CDN — use `<i class="fa-solid fa-..."></i>`
- HTTP: typed services in `core/api/` using `HttpClient` with functional interceptors
- Real-time: `@microsoft/signalr` in `core/signalr/device-hub.service.ts` — expose as Signal streams
- Auth: JWT in `sessionStorage`; `auth.interceptor.ts` attaches Bearer header; `auth.guard.ts` protects routes
- **Never** use `NgZone` hacks — all async is Signals-based
- Reactive forms with `FormBuilder` for all create/edit dialogs

### Angular project structure
```
src/app/
  core/
    auth/         — AuthService, auth.interceptor, auth.guard
    api/          — DevicesService, AccountsService, AgentsService, DashboardService
    signalr/      — DeviceHubService
  shared/
    components/   — StatusBadge, PlatformIcon, ConfirmDialog, PaginatedTable
  layout/         — ShellComponent (sidebar + topbar)
  features/
    auth/login/
    dashboard/
    devices/      — DeviceList, DeviceDetail (tabs: Info | Accounts | Session Log)
    accounts/     — AccountList, AccountForm
    admin/users/
```

---

## File Location Quick Reference

| What | Where |
|---|---|
| ADB / WS binary protocol | `server/src/server/goog-device/` |
| Video decode workers | `client/src/workers/` |
| Touch/key binary encoding | `client/src/lib/control.ts` |
| WS multiplexer | `client/src/lib/multiplexer.ts` |
| EF Core DbContext | `api/PhoneFarm.Infrastructure/Data/PhoneFarmDbContext.cs` |
| EF entity configs | `api/PhoneFarm.Infrastructure/Data/Configurations/` |
| API controllers | `api/PhoneFarm.API/Controllers/` |
| SignalR hub | `api/PhoneFarm.API/Hubs/DeviceHub.cs` |
| Angular services | `ui/src/app/core/` |
| Angular feature components | `ui/src/app/features/` |

---

## Full docs

- Architecture overview: `docs/ARCHITECTURE_PLAN.md`
- Per-layer details: `docs/layers/LAYER_0_CLIENT.md` … `LAYER_4_ANGULAR.md`
- DB schema: `docs/layers/LAYER_2_DATABASE.md`
- API endpoints: `docs/layers/LAYER_3_API.md`
