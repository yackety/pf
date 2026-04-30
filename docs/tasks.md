# Implementation Tasks

Track progress across all phases. Mark tasks `[x]` when complete.
When a task is done during a Copilot session, the agent will automatically prompt to update this file.

---

## Phase 1 — MSSQL Schema + EF Core Migrations
> Layer 2 · Prerequisite for everything else

- [ ] Create `PhoneFarm` database on MSSQL server
- [ ] Create `Agents` table
- [ ] Create `Devices` table
- [ ] Create `Platforms` table + seed rows (facebook, tiktok, google, youtube, instagram, twitter)
- [ ] Create `Accounts` table
- [ ] Create `DeviceAccounts` join table
- [ ] Create `Users` table
- [ ] Create `DeviceSessionLog` table
- [ ] Add all indexes (state, platform, agentId, active assignments, session log history)
- [ ] Set up `PhoneFarm.Infrastructure` project (EF Core 8, `Microsoft.Data.SqlClient`)
- [ ] Create `PhoneFarmDbContext` with all entity configurations
- [ ] Generate and verify initial EF Core migration runs clean

---

## Phase 2 — Node.js Agent DB Integration
> Layer 1 · Extends existing `server/`

- [ ] Add `mssql` (or `tedious`) npm package to `server/`
- [ ] Create SQL connection pool service (max 5 connections, fire-and-forget writes)
- [ ] Add `database.connectionString`, `agent.id`, `agent.host` to `config.yaml` schema
- [ ] Register / upsert agent row in `Agents` table on startup
- [ ] Implement heartbeat service — update `Agents.LastHeartbeatAt` every 30 s
- [ ] Hook into Android `DeviceTrackerEvent` → upsert `Devices` row
- [ ] Hook into iOS `DeviceTrackerEvent` → upsert `Devices` row
- [ ] Implement `IpAddresses` JSON serialization from `NetInterface[]`
- [ ] Implement `DeviceSessionLog` append on connect / disconnect / state change
- [ ] Handle agent shutdown — set `Agents.IsOnline = 0`
- [ ] Verify: connect a real device → row appears in DB with correct props

---

## Phase 3 — .NET Core API · Auth + Devices
> Layer 3 · First API milestone

- [ ] Create solution: `PhoneFarm.sln` with Domain / Infrastructure / Application / API projects
- [ ] Wire EF Core `PhoneFarmDbContext` into `PhoneFarm.Infrastructure`
- [ ] Run migrations from API project (`dotnet ef database update`)
- [ ] Implement JWT auth — `POST /api/auth/login` returns access token
- [ ] Implement refresh token — `POST /api/auth/refresh`
- [ ] Implement `POST /api/auth/logout` (invalidate refresh token)
- [ ] Add `authGuard` middleware (role: admin, operator)
- [ ] `GET /api/agents` — list all agents with online status + device count
- [ ] `GET /api/agents/{agentId}` — single agent detail
- [ ] `GET /api/agents/{agentId}/devices` — devices under an agent
- [ ] `GET /api/devices` — paginated list with filters (state, platform, agentId, tag, search)
- [ ] `GET /api/devices/{udid}` — full device detail from DB
- [ ] `PATCH /api/devices/{udid}` — update tags, notes
- [ ] `GET /api/devices/{udid}/log` — paginated session log
- [ ] Pagination envelope: `{ data, total, page, pageSize }`
- [ ] Verify Swagger / OpenAPI doc generated correctly

---

## Phase 4 — .NET Core API · Accounts + Device Linking
> Layer 3 · Second API milestone

- [ ] `GET /api/platforms` — lookup list for dropdowns
- [ ] `GET /api/accounts` — paginated, filter by platformId / status / search
- [ ] `GET /api/accounts/{id}` — detail + current device assignments
- [ ] `POST /api/accounts` — create account
- [ ] `PUT /api/accounts/{id}` — update account
- [ ] `DELETE /api/accounts/{id}` — soft-delete (set inactive)
- [ ] `GET /api/devices/{udid}/accounts` — accounts currently linked to device
- [ ] `POST /api/devices/{udid}/accounts/{accountId}` — link account to device
- [ ] `DELETE /api/devices/{udid}/accounts/{accountId}` — unlink account
- [ ] `GET /api/dashboard/stats` — total devices, online/offline, per-platform account counts
- [ ] `GET /api/users` (admin) — list users
- [ ] `POST /api/users` (admin) — create user
- [ ] `PUT /api/users/{id}` (admin) — update role / active status

---

## Phase 5 — .NET Core API · Agent Proxy + SignalR
> Layer 3 · Final API milestone

- [ ] Set up SignalR hub — `DeviceHub` at `/hubs/devices`
- [ ] Broadcast `DeviceStateChanged` event
- [ ] Broadcast `AgentOnline` / `AgentOffline` events
- [ ] Broadcast `DeviceConnected` / `DeviceDisconnected` events
- [ ] Implement `POST /api/devices/{udid}/action` — proxy to agent HTTP endpoint
- [ ] Implement heartbeat monitor `IHostedService` — poll `Agents.LastHeartbeatAt` every 60 s, mark offline after 90 s
- [ ] Test end-to-end: disconnect a device → SignalR fires → agent heartbeat timeout triggers offline

---

## Phase 6 — Angular · Shell, Auth, Dashboard
> Layer 4 · First UI milestone

- [ ] `ng new phonefarm-ui` with standalone / no routing (we add manually)
- [ ] Install and configure Tailwind CSS v4 (PostCSS plugin)
- [ ] Write `tailwind.config.ts` with full design token color map (CSS vars)
- [ ] Write `styles.css` with `:root` (light) and `.dark` (dark) CSS custom properties
- [ ] Add FA 6 CDN `<link>` + Google Fonts to `index.html`
- [ ] Implement `ThemeService` (signal, localStorage, OS fallback, `APP_INITIALIZER`)
- [ ] Create `ThemeToggleComponent` (sun/moon FA icon button)
- [ ] Create `ShellComponent` (collapsible sidebar + topbar)
- [ ] Create `nav-items.ts` config with FA icon classes per route
- [ ] Implement `AuthService` (login, logout, token in `sessionStorage`)
- [ ] Implement `AuthInterceptor` (attach Bearer, 401 → refresh → retry)
- [ ] Implement `authGuard` + `adminGuard` functional guards
- [ ] Create `LoginComponent` (reactive form, pill inputs, error state)
- [ ] Create `DashboardComponent` (stat cards + device tile grid)
- [ ] Create `DashboardService` (`GET /api/dashboard/stats`)
- [ ] Wire SignalR `DeviceHubService` (connect on app init, expose Signals)
- [ ] Verify dashboard stat cards update live via SignalR

---

## Phase 7 — Angular · Device List + Detail
> Layer 4 · Second UI milestone

- [ ] Create `DevicesService` (typed wrappers for all `/api/devices/*` endpoints)
- [ ] Create `StatusBadgeComponent` (online / offline / banned pill with FA dot)
- [ ] Create `PlatformIconComponent` (FA brand icon mapped from platform name string)
- [ ] Create `PaginatedTableComponent` (generic, sortable, keyboard accessible)
- [ ] Create `DeviceListComponent` — filterable/sortable table with pagination
- [ ] Create `DeviceDetailComponent` — three tabs: Info | Accounts | Session Log
- [ ] Device Info tab — all DB props, collapsible raw JSON, tags/notes edit
- [ ] Device Accounts tab — linked accounts list + add/remove button
- [ ] Device Log tab — paginated `DeviceSessionLog` timeline
- [ ] "Send Command" dialog — calls `POST /api/devices/{udid}/action`
- [ ] Live row updates via SignalR signals (no full re-fetch on state change)
- [ ] AXE audit: DeviceList + DeviceDetail pages pass

---

## Phase 8 — Angular · Account Management + Linking
> Layer 4 · Final UI milestone

- [ ] Create `AccountsService` (typed wrappers for all `/api/accounts/*` endpoints)
- [ ] Create `AccountListComponent` — filter by platform / status / search text
- [ ] Create `AccountFormComponent` — create/edit dialog (reactive form, validation)
- [ ] Device Detail → Accounts tab: search-and-add account linking flow
- [ ] Create admin `UsersComponent` — list + create/edit (admin guard)
- [ ] Create `ConfirmDialogComponent` — accessible modal with focus trap
- [ ] Final full AXE + WCAG AA audit across all pages
- [ ] Verify light ↔ dark theme toggle works on all pages with no contrast failures
