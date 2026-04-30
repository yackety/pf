# Architecture Plan — PhoneFarm Management System

## Overview

The system is composed of four layers:

```
[Android/iOS Devices]
        ↓ ADB / WDA
[Node.js Agent (local)]  ──upsert/sync──→  [MSSQL Database]
        ↑  WebSocket/HTTP                          ↑
[React Client (local)]                [.NET Core Management API]
  (admin stream viewer)                             ↑  (REST + SignalR)
                                          [Angular 21 Web UI]
```

- **React client (local)** = administrator stream viewer — runs on the same machine as the agent; directly connects to the Node.js agent for live device video streams and control
- **Node.js server** = local agent — manages device connections, streams, and writes device data to MSSQL
- **.NET Core API** = management backend — reads from MSSQL, proxies control commands to the local agent's API
- **Angular 21** = remote management frontend — reads everything from the .NET Core API only

---

## Layer 0 — React Client (Local Admin Viewer)

**Role:** Runs on the same machine (or LAN) as the Node.js agent. Used exclusively by the on-site administrator for real-time device screen viewing and direct control. This is the existing `client/` Vite + React app — no changes to its core purpose are planned.

### Responsibilities
- Connect directly to the Node.js agent via WebSocket for low-latency video stream (H.264 / WebCodecs)
- Send touch/keyboard/control events back to the agent in real time
- Display all locally connected devices as tiles (`Tile` component) with live stream
- Provide quick actions: Home, Back, Power, Volume, Screenshot, Shell, File Browser
- Sync panel for multi-device coordinated input (`SyncPanel`)

### Key characteristics
| Property | Value |
|---|---|
| Access | Local network only (same host or LAN) |
| Auth | None required (trusted local network) |
| Data source | Node.js agent WebSocket + HTTP directly |
| Purpose | Stream view + real-time control only |
| Tech | React 18, Vite, WebCodecs API, Canvas |

### Pages
| Page | Description |
|---|---|
| Main (`App.tsx`) | Device tile grid — all connected devices as live video tiles |
| Device Viewer (`DeviceViewer.tsx`) | Full-screen single-device stream with control overlay |
| Shell (`ShellPage.tsx`) | ADB shell terminal for a selected device |
| File Browser (`FileListingPage.tsx`) | Browse and push files on a device |

### Relationship to other layers
- **Does NOT** talk to the .NET Core API — it is purely a local streaming tool
- **Does NOT** store anything — all persistence is handled by the Node.js agent writing to MSSQL
- The .NET Core API can proxy stream URLs or screenshot commands to the agent if the Angular UI needs them; the React client is independent of that flow

---

## Layer 1 — Node.js Local Agent

**Role:** Runs on the same machine (or LAN) as the physical devices. Acts as the ADB/WDA bridge and data collector.

### Responsibilities
- Detect device connect/disconnect events via existing `DeviceTrackerEvent`
- On device change: upsert full device properties into MSSQL
- Expose existing HTTP/WebSocket API for streaming and control (used by .NET Core as proxy target)
- Periodically refresh live properties (battery, network, state) and update DB

### DB Write Points
| Event | Action |
|---|---|
| Device connected | INSERT or UPDATE `Devices` row with all props |
| Device state change | UPDATE `state`, `last_state_change_at` |
| Properties refresh | UPDATE `raw_props`, `last_seen_at` |
| Device disconnected | UPDATE `state = 'disconnected'` |

### Agent Config additions (`config.yaml`)
```yaml
database:
  connectionString: "Server=...;Database=PhoneFarm;..."
agentId: "agent-office-01"   # unique ID per physical host
agentHost: "http://192.168.1.10:11000"  # reported back to .NET API
```

---

## Layer 2 — MSSQL Database Schema

**Database:** `PhoneFarm`

### Tables

#### `Agents`
| Column | Type | Notes |
|---|---|---|
| `Id` | `int` PK | |
| `AgentId` | `nvarchar(100)` UNIQUE | e.g. `agent-office-01` |
| `Host` | `nvarchar(255)` | base URL of the Node.js agent |
| `LastHeartbeatAt` | `datetime2` | |
| `IsOnline` | `bit` | |

#### `Devices`
| Column | Type | Notes |
|---|---|---|
| `Id` | `int` PK | |
| `Udid` | `nvarchar(100)` UNIQUE | ADB serial / iOS UDID |
| `Platform` | `nvarchar(10)` | `android` / `ios` |
| `AgentId` | `int` FK → `Agents` | which local agent manages it |
| `State` | `nvarchar(50)` | `device`, `disconnected`, `Connected`, etc. |
| `Manufacturer` | `nvarchar(100)` | Android only |
| `Model` | `nvarchar(100)` | |
| `OsVersion` | `nvarchar(50)` | Android release / iOS version |
| `SdkVersion` | `nvarchar(20)` | Android SDK int |
| `CpuAbi` | `nvarchar(50)` | Android only |
| `WifiInterface` | `nvarchar(50)` | Android only |
| `IpAddresses` | `nvarchar(max)` | JSON array of `{iface, ipv4, ipv6}` |
| `DeviceName` | `nvarchar(100)` | iOS display name |
| `RawProps` | `nvarchar(max)` | full JSON snapshot of descriptor |
| `Tags` | `nvarchar(500)` | comma-separated or JSON |
| `Notes` | `nvarchar(max)` | operator freetext |
| `FirstSeenAt` | `datetime2` | |
| `LastSeenAt` | `datetime2` | |
| `LastStateChangeAt` | `datetime2` | |

#### `Platforms` (lookup)
| Column | Type |
|---|---|
| `Id` | `int` PK |
| `Name` | `nvarchar(50)` | `facebook`, `tiktok`, `google`, `youtube`, `instagram`, ... |

#### `Accounts`
| Column | Type | Notes |
|---|---|---|
| `Id` | `int` PK | |
| `PlatformId` | `int` FK → `Platforms` | |
| `Username` | `nvarchar(200)` | |
| `DisplayName` | `nvarchar(200)` | |
| `Email` | `nvarchar(200)` | optional |
| `Phone` | `nvarchar(50)` | optional |
| `Status` | `nvarchar(50)` | `active`, `suspended`, `banned`, `inactive` |
| `Notes` | `nvarchar(max)` | |
| `CreatedAt` | `datetime2` | |
| `UpdatedAt` | `datetime2` | |

#### `DeviceAccounts` (join — many accounts per device)
| Column | Type | Notes |
|---|---|---|
| `Id` | `int` PK | |
| `DeviceId` | `int` FK → `Devices` | |
| `AccountId` | `int` FK → `Accounts` | |
| `AssignedAt` | `datetime2` | |
| `UnassignedAt` | `datetime2` | null = currently assigned |
| `AssignedBy` | `int` FK → `Users` | |
| `Notes` | `nvarchar(max)` | |

#### `Users` (internal operators)
| Column | Type | Notes |
|---|---|---|
| `Id` | `int` PK | |
| `Username` | `nvarchar(100)` UNIQUE | |
| `PasswordHash` | `nvarchar(255)` | bcrypt |
| `Role` | `nvarchar(50)` | `admin`, `operator` |
| `IsActive` | `bit` | |
| `CreatedAt` | `datetime2` | |

#### `DeviceSessionLog` (audit)
| Column | Type | Notes |
|---|---|---|
| `Id` | `bigint` PK | |
| `DeviceId` | `int` FK → `Devices` | |
| `Event` | `nvarchar(100)` | `connected`, `disconnected`, `state_changed` |
| `OldState` | `nvarchar(50)` | |
| `NewState` | `nvarchar(50)` | |
| `OccurredAt` | `datetime2` | |

---

## Layer 3 — .NET Core Management API

**Tech:** ASP.NET Core 10, EF Core 10, MSSQL, SignalR

### Solution structure
```
PhoneFarm.sln
├── PhoneFarm.Domain          — entities, enums, interfaces
├── PhoneFarm.Infrastructure  — EF Core DbContext, repositories, MSSQL migrations
├── PhoneFarm.Application     — use cases / services, DTOs, MediatR handlers
└── PhoneFarm.API             — controllers, SignalR hub, auth middleware
```

### API Endpoints

#### Agents
| Method | Route | Description |
|---|---|---|
| GET | `/api/agents` | List all registered agents + online status |
| GET | `/api/agents/{agentId}/devices` | Devices managed by an agent |

#### Devices
| Method | Route | Description |
|---|---|---|
| GET | `/api/devices` | Paginated list with filters (state, platform, agent, tag) |
| GET | `/api/devices/{udid}` | Full device detail from DB |
| PATCH | `/api/devices/{udid}` | Update tags, notes |
| GET | `/api/devices/{udid}/accounts` | Accounts linked to device |
| POST | `/api/devices/{udid}/accounts/{accountId}` | Link account to device |
| DELETE | `/api/devices/{udid}/accounts/{accountId}` | Unlink account |
| POST | `/api/devices/{udid}/action` | Proxy command to Node.js agent (reboot, screenshot, etc.) |

#### Accounts
| Method | Route | Description |
|---|---|---|
| GET | `/api/accounts` | Paginated list, filter by platform/status |
| GET | `/api/accounts/{id}` | Account detail + assigned devices |
| POST | `/api/accounts` | Create account |
| PUT | `/api/accounts/{id}` | Update account |
| DELETE | `/api/accounts/{id}` | Delete account |

#### Dashboard
| Method | Route | Description |
|---|---|---|
| GET | `/api/dashboard/stats` | Total devices, online/offline counts, accounts per platform |

#### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Returns JWT |
| POST | `/api/auth/refresh` | Refresh token |

### Agent Proxy Pattern
When a command needs to reach a physical device (e.g. screenshot, reboot):
1. Angular calls `.NET Core API` → `POST /api/devices/{udid}/action`
2. .NET Core resolves which `Agent.Host` manages that `udid` (from DB)
3. .NET Core proxies the HTTP request to `http://{agentHost}/api/action/{udid}`
4. Response returned to Angular

### SignalR Hub — `/hubs/devices`
- Broadcasts device state changes in real time (fed from DB change polling or agent heartbeat)
- Angular subscribes to `DeviceStateChanged`, `AgentOnline`, `AgentOffline` events

---

## Layer 4 — Angular 21 Web UI

**Tech:** Angular 21, Angular Signals, Angular Material, SignalR client (`@microsoft/signalr`)

### Project structure
```
phonefarm-ui/
├── core/
│   ├── auth/           — JWT interceptor, auth guard, login service
│   ├── api/            — typed HTTP clients for each .NET Core endpoint
│   └── signalr/        — SignalR service wrapping hub connection
├── shared/
│   └── components/     — status badges, platform icons, data tables, confirm dialogs
├── features/
│   ├── dashboard/      — live stats cards + device grid overview
│   ├── devices/
│   │   ├── device-list/     — filterable, sortable table
│   │   └── device-detail/   — tabs: Info | Accounts | Session Log
│   ├── accounts/
│   │   ├── account-list/    — filterable by platform/status
│   │   └── account-form/    — create/edit account
│   └── admin/
│       └── users/           — user management (admin role only)
└── layout/             — shell, sidebar nav, top bar
```

### Key UI Behaviours
- Device grid cells update live via SignalR without page refresh
- Device detail page: "Linked Accounts" tab allows drag-and-drop or search-and-add
- Platform filter uses `Platforms` lookup (facebook, tiktok, google, etc.)
- Offline devices shown greyed out; clicking still shows last-known info from DB
- Auth: JWT stored in `sessionStorage`; route guards for admin-only pages

---

## Build Order

| Phase | Deliverable |
|---|---|
| 0 | _(existing)_ React local client — no changes needed, already functional |
| 1 | MSSQL schema + EF Core migrations |
| 2 | Node.js agent DB upsert integration |
| 3 | .NET Core API — devices + auth endpoints |
| 4 | .NET Core API — accounts + device linking |
| 5 | .NET Core API — agent proxy + SignalR hub |
| 6 | Angular — shell, auth, dashboard |
| 7 | Angular — device list + detail |
| 8 | Angular — account management + linking |
