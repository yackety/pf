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

| Layer | Name | Location | Role |
|---|---|---|---|
| 0 | React Client | Local (same host as agent) | Live stream viewer & device control for on-site admin |
| 1 | Node.js Agent | Local (same host as devices) | ADB/WDA bridge; writes device data to MSSQL |
| 2 | MSSQL Database | Shared / hosted | Central data store for all device, account, and user data |
| 3 | .NET Core API | Server / hosted | Management API; reads DB, proxies commands to agent |
| 4 | Angular 21 UI | Browser (remote) | Web dashboard; talks exclusively to .NET Core API |

---

## Layer Summaries

### Layer 0 — React Client (Local Admin Viewer)
Existing `client/` Vite + React app. Runs on-site alongside the agent. Used by the local administrator for real-time device screen streaming and direct control. Connects directly to the Node.js agent via WebSocket — no interaction with .NET Core or the DB.
→ See [layers/LAYER_0_CLIENT.md](layers/LAYER_0_CLIENT.md)

### Layer 1 — Node.js Agent
Existing `server/` Node.js app, extended with DB write capability. Manages ADB/WDA connections, emits device tracker events, and upserts device data into MSSQL on connect/disconnect/refresh. Also exposes HTTP/WS endpoints that the .NET Core API can proxy commands to.
→ See [layers/LAYER_1_AGENT.md](layers/LAYER_1_AGENT.md)

### Layer 2 — MSSQL Database
Central store for the platform. Holds agents, devices (full props + raw snapshot), social accounts, device-to-account linking, internal users, and device session audit log.
→ See [layers/LAYER_2_DATABASE.md](layers/LAYER_2_DATABASE.md)

### Layer 3 — .NET Core Management API
New ASP.NET Core 10 solution. Business logic layer for device metadata management, account linking, user auth (JWT), and proxying control commands down to the local agent. Exposes a SignalR hub for real-time state push to the Angular UI.
→ See [layers/LAYER_3_API.md](layers/LAYER_3_API.md)

### Layer 4 — Angular 21 Web UI
New Angular 21 SPA. Remote management dashboard for operators and admins. All data comes from the .NET Core API — never directly from the agent or DB. Supports live updates via SignalR.
→ See [layers/LAYER_4_ANGULAR.md](layers/LAYER_4_ANGULAR.md)

---

## Build Order

| Phase | Layer | Deliverable |
|---|---|---|
| 0 | — | _(existing)_ React local client — no changes needed |
| 1 | 2 | MSSQL schema + EF Core migrations |
| 2 | 1 | Node.js agent — DB upsert integration |
| 3 | 3 | .NET Core API — auth + devices endpoints |
| 4 | 3 | .NET Core API — accounts + device linking |
| 5 | 3 | .NET Core API — agent proxy + SignalR hub |
| 6 | 4 | Angular — shell, auth, dashboard |
| 7 | 4 | Angular — device list + detail |
| 8 | 4 | Angular — account management + linking |
