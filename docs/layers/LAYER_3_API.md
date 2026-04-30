# Layer 3 — .NET Core Management API

## Purpose

The ASP.NET Core 10 API is the **management backend**. It owns all business logic for device metadata, account management, user administration, and real-time event broadcasting. It is the single data source for the Angular UI.

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | ASP.NET Core 10 |
| ORM | EF Core 10 |
| Database | MSSQL (via `Microsoft.Data.SqlClient`) |
| Real-time | SignalR |
| Auth | JWT Bearer tokens (short-lived access + refresh tokens) |
| Mediation | MediatR (optional, for complex use cases) |
| HTTP proxy | `HttpClient` / `IHttpClientFactory` for agent forwarding |

## Solution Structure

```
PhoneFarm.sln
├── PhoneFarm.Domain
│   ├── Entities/          — Device, Agent, Account, DeviceAccount, User, Platform
│   ├── Enums/             — DeviceState, AccountStatus, UserRole, Platform
│   └── Interfaces/        — IDeviceRepository, IAccountRepository, IAgentProxy, ...
│
├── PhoneFarm.Infrastructure
│   ├── Data/
│   │   ├── PhoneFarmDbContext.cs
│   │   ├── Configurations/    — EF entity configs (table names, indexes, FK)
│   │   └── Migrations/
│   ├── Repositories/          — EF implementations of domain interfaces
│   └── AgentProxy/            — HttpClient-based forwarding to Node.js agent
│
├── PhoneFarm.Application
│   ├── Devices/           — GetDevices, GetDevice, UpdateDeviceMeta, LinkAccount
│   ├── Accounts/          — CreateAccount, UpdateAccount, GetAccounts
│   ├── Dashboard/         — GetStats
│   └── Auth/              — Login, RefreshToken
│
└── PhoneFarm.API
    ├── Controllers/
    ├── Hubs/              — DeviceHub (SignalR)
    ├── Middleware/        — JWT validation, exception handling
    └── Program.cs
```

## API Endpoints

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Username + password → JWT access token + refresh token |
| POST | `/api/auth/refresh` | Public | Refresh token → new access token |
| POST | `/api/auth/logout` | Bearer | Invalidate refresh token |

### Agents
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/agents` | Operator | List all agents with online status and device count |
| GET | `/api/agents/{agentId}` | Operator | Single agent detail |
| GET | `/api/agents/{agentId}/devices` | Operator | All devices under an agent |

### Devices
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/devices` | Operator | Paginated list; filters: `state`, `platform`, `agentId`, `tag`, `search` |
| GET | `/api/devices/{udid}` | Operator | Full device detail from DB |
| PATCH | `/api/devices/{udid}` | Operator | Update `tags`, `notes` |
| GET | `/api/devices/{udid}/accounts` | Operator | Accounts currently linked to device |
| POST | `/api/devices/{udid}/accounts/{accountId}` | Operator | Link account to device |
| DELETE | `/api/devices/{udid}/accounts/{accountId}` | Operator | Unlink account from device |
| GET | `/api/devices/{udid}/log` | Operator | Device session history (paginated) |
| POST | `/api/devices/{udid}/action` | Operator | Proxy a control command to the agent |

### Accounts
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/accounts` | Operator | Paginated list; filters: `platformId`, `status`, `search` |
| GET | `/api/accounts/{id}` | Operator | Account detail + current device assignments |
| POST | `/api/accounts` | Operator | Create account |
| PUT | `/api/accounts/{id}` | Operator | Update account |
| DELETE | `/api/accounts/{id}` | Admin | Soft-delete (set inactive) |

### Platforms
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/platforms` | Operator | List all platforms (for dropdowns) |

### Dashboard
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard/stats` | Operator | Total devices, online/offline, per-platform account counts, agent statuses |

### Users (Admin only)
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/users` | Admin | List all users |
| POST | `/api/users` | Admin | Create user |
| PUT | `/api/users/{id}` | Admin | Update role / active status |
| DELETE | `/api/users/{id}` | Admin | Deactivate user |

## Agent Proxy Pattern

When the Angular UI needs to trigger a device action (screenshot, reboot, ADB command):

```
Angular UI
    → POST /api/devices/{udid}/action  { "type": "screenshot" }
        ↓
    .NET Core API
        1. Lookup Device in DB → get AgentId → get Agent.Host
        2. POST http://{Agent.Host}/api/devices/{udid}/action
        3. Stream response back to Angular
```

- Agent host URL comes from `Agents.Host` in the DB
- If agent is offline (`IsOnline = false`), return `503 Service Unavailable` immediately
- Timeout: 10 seconds for action proxy calls

## SignalR Hub — `/hubs/devices`

**Hub class:** `DeviceHub`

### Events broadcast to clients

| Event | Payload | Trigger |
|---|---|---|
| `DeviceStateChanged` | `{ udid, state, lastSeenAt }` | Agent heartbeat polling detects DB change |
| `AgentOnline` | `{ agentId }` | Agent heartbeat seen after offline period |
| `AgentOffline` | `{ agentId }` | Missed heartbeats threshold exceeded |
| `DeviceConnected` | `{ udid, platform, model }` | New device row detected |
| `DeviceDisconnected` | `{ udid }` | Device state → disconnected |

### Heartbeat Monitor
A background `IHostedService` polls `Agents.LastHeartbeatAt` every 60 seconds. Any agent with no heartbeat in the last 90 seconds is marked offline and `AgentOffline` is broadcast.

## Auth Design

- **Access token:** JWT, 15-minute expiry, contains `userId`, `username`, `role`
- **Refresh token:** opaque random string, stored server-side (in DB or cache), 7-day expiry
- **Roles:** `admin` (full access), `operator` (read + assign accounts, no user management)
- All endpoints except `/api/auth/*` require Bearer token

## Pagination Convention

All list endpoints accept:
```
?page=1&pageSize=50&sortBy=lastSeenAt&sortDir=desc
```
Response envelope:
```json
{
  "data": [...],
  "total": 120,
  "page": 1,
  "pageSize": 50
}
```
