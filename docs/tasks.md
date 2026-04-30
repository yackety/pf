# Implementation Tasks

Track progress across all phases. Mark tasks `[x]` when complete.
When a task is done during a Copilot session, the agent will automatically prompt to update this file.

---

## Phase 1 — MSSQL Schema + EF Core Migrations
> Layer 2 · Prerequisite for everything else

- [x] Create `PhoneFarm` database on MSSQL server
- [x] Create `Agents` table
- [x] Create `Devices` table
- [x] Create `Platforms` table + seed rows (facebook, tiktok, google, youtube, instagram, twitter)
- [x] Create `Accounts` table
- [x] Create `DeviceAccounts` join table
- [x] Create `Users` table
- [x] Create `DeviceSessionLog` table
- [x] Add all indexes (state, platform, agentId, active assignments, session log history)
- [x] Set up `PhoneFarm.Infrastructure` project (EF Core 10, `Microsoft.Data.SqlClient`)
- [x] Create `PhoneFarmDbContext` with all entity configurations
- [x] Generate and verify initial EF Core migration runs clean

---

## Phase 2 — Node.js Agent DB Integration
> Layer 1 · Extends existing `server/`

- [x] Add `mssql` (or `tedious`) npm package to `server/`
- [x] Create SQL connection pool service (max 5 connections, fire-and-forget writes)
- [x] Add `database.connectionString`, `agent.id`, `agent.host` to `config.yaml` schema
- [x] Register / upsert agent row in `Agents` table on startup
- [x] Implement heartbeat service — update `Agents.LastHeartbeatAt` every 30 s
- [x] Hook into Android `DeviceTrackerEvent` → upsert `Devices` row
- [x] Hook into iOS `DeviceTrackerEvent` → upsert `Devices` row
- [x] Implement `IpAddresses` JSON serialization from `NetInterface[]`
- [x] Implement `DeviceSessionLog` append on connect / disconnect / state change
- [x] Handle agent shutdown — set `Agents.IsOnline = 0`
- [ ] Verify: connect a real device → row appears in DB with correct props

---

## Phase 3 — .NET Core API · Auth + Devices
> Layer 3 · First API milestone

- [x] Create solution: `PhoneFarm.sln` with Domain / Infrastructure / Application / API projects
- [x] Wire EF Core `PhoneFarmDbContext` into `PhoneFarm.Infrastructure`
- [ ] Run migrations from API project (`dotnet ef database update`)
- [x] Implement JWT auth — `POST /api/auth/login` returns access token
- [x] Implement refresh token — `POST /api/auth/refresh`
- [x] Implement `POST /api/auth/logout` (invalidate refresh token)
- [x] Add `authGuard` middleware (role: admin, operator)
- [x] `GET /api/agents` — list all agents with online status + device count
- [x] `GET /api/agents/{agentId}` — single agent detail
- [x] `GET /api/agents/{agentId}/devices` — devices under an agent
- [x] `GET /api/devices` — paginated list with filters (state, platform, agentId, tag, search)
- [x] `GET /api/devices/{udid}` — full device detail from DB
- [x] `PATCH /api/devices/{udid}` — update tags, notes
- [x] `GET /api/devices/{udid}/log` — paginated session log
- [x] Pagination envelope: `{ data, total, page, pageSize }`
- [x] Verify Swagger / OpenAPI doc generated correctly

---

## Phase 4 — .NET Core API · Accounts + Device Linking
> Layer 3 · Second API milestone

- [x] `GET /api/platforms` — lookup list for dropdowns
- [x] `GET /api/accounts` — paginated, filter by platformId / status / search
- [x] `GET /api/accounts/{id}` — detail + current device assignments
- [x] `POST /api/accounts` — create account
- [x] `PUT /api/accounts/{id}` — update account
- [x] `DELETE /api/accounts/{id}` — soft-delete (set inactive)
- [x] `GET /api/devices/{udid}/accounts` — accounts currently linked to device
- [x] `POST /api/devices/{udid}/accounts/{accountId}` — link account to device
- [x] `DELETE /api/devices/{udid}/accounts/{accountId}` — unlink account
- [x] `GET /api/dashboard/stats` — total devices, online/offline, per-platform account counts
- [x] `GET /api/users` (admin) — list users
- [x] `POST /api/users` (admin) — create user
- [x] `PUT /api/users/{id}` (admin) — update role / active status

---

## Phase 5 — .NET Core API · Agent Proxy + SignalR
> Layer 3 · Final API milestone

- [x] Set up SignalR hub — `DeviceHub` at `/hubs/devices`
- [x] Broadcast `DeviceStateChanged` event
- [x] Broadcast `AgentOnline` / `AgentOffline` events
- [x] Broadcast `DeviceConnected` / `DeviceDisconnected` events
- [x] Implement `POST /api/devices/{udid}/action` — proxy to agent HTTP endpoint
- [x] Implement heartbeat monitor `IHostedService` — poll `Agents.LastHeartbeatAt` every 60 s, mark offline after 90 s
- [ ] Test end-to-end: disconnect a device → SignalR fires → agent heartbeat timeout triggers offline

---

## Phase 6 — Angular · Shell, Auth, Dashboard
> Layer 4 · First UI milestone

- [x] Install and configure Tailwind CSS v4 (PostCSS plugin)
- [x] Write `tailwind.config.ts` with full design token color map (CSS vars)
- [x] Write `styles.css` with `:root` (light) and `.dark` (dark) CSS custom properties
- [x] Add FA 6 CDN `<link>` + Google Fonts to `index.html`
- [x] Implement `ThemeService` (signal, localStorage, OS fallback, `APP_INITIALIZER`)
- [x] Create `ThemeToggleComponent` (sun/moon FA icon button)
- [x] Create `ShellComponent` (collapsible sidebar + topbar)
- [x] Create `nav-items.ts` config with FA icon classes per route
- [x] Implement `AuthService` (login, logout, token in `sessionStorage`)
- [x] Implement `AuthInterceptor` (attach Bearer, 401 → refresh → retry)
- [x] Implement `authGuard` + `adminGuard` functional guards
- [x] Create `LoginComponent` (reactive form, pill inputs, error state)
- [x] Create `DashboardComponent` (stat cards + device tile grid)
- [x] Create `DashboardService` (`GET /api/dashboard/stats`)
- [x] Wire SignalR `DeviceHubService` (connect on app init, expose Signals)
- [ ] Verify dashboard stat cards update live via SignalR

---

## Phase 7 — Angular · Device List + Detail
> Layer 4 · Second UI milestone

- [x] Create `DevicesService` (typed wrappers for all `/api/devices/*` endpoints)
- [x] Create `StatusBadgeComponent` (online / offline / banned pill with FA dot)
- [x] Create `PlatformIconComponent` (FA brand icon mapped from platform name string)
- [x] Create `PaginatedTableComponent` (generic, sortable, keyboard accessible)
- [x] Create `DeviceListComponent` — filterable/sortable table with pagination
- [x] Create `DeviceDetailComponent` — three tabs: Info | Accounts | Session Log
- [x] Device Info tab — all DB props, collapsible raw JSON, tags/notes edit
- [x] Device Accounts tab — linked accounts list + add/remove button
- [x] Device Log tab — paginated `DeviceSessionLog` timeline
- [x] "Send Command" dialog — calls `POST /api/devices/{udid}/action`
- [x] Live row updates via SignalR signals (no full re-fetch on state change)
- [ ] AXE audit: DeviceList + DeviceDetail pages pass

---

## Phase 8 — Angular · Account Management + Linking
> Layer 4 · Final UI milestone

- [x] Create `AccountsService` (typed wrappers for all `/api/accounts/*` endpoints)
- [x] Create `AccountListComponent` — filter by platform / status / search text
- [x] Create `AccountFormComponent` — create/edit dialog (reactive form, validation)
- [x] Device Detail → Accounts tab: search-and-add account linking flow
- [x] Create admin `UsersComponent` — list + create/edit (admin guard)
- [x] Create `ConfirmDialogComponent` — accessible modal with focus trap
- [ ] Final full AXE + WCAG AA audit across all pages
- [ ] Verify light ↔ dark theme toggle works on all pages with no contrast failures
