# Layer 2 — MSSQL Database

## Purpose

Central data store for the entire platform. Owned and written to by the Node.js agent; read and further enriched by the .NET Core API.

## Database Name

`PhoneFarm`

## Tables

---

### `Agents`
Represents a physical host running the Node.js agent.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `Id` | `int` | PK, IDENTITY | |
| `AgentId` | `nvarchar(100)` | UNIQUE, NOT NULL | Human-readable ID e.g. `agent-office-01` |
| `Host` | `nvarchar(255)` | NOT NULL | Base URL the .NET Core API calls e.g. `http://192.168.1.10:11000` |
| `LastHeartbeatAt` | `datetime2` | NULL | Updated every 30s by agent |
| `IsOnline` | `bit` | NOT NULL, DEFAULT 0 | Set to 0 on shutdown or missed heartbeats |
| `RegisteredAt` | `datetime2` | NOT NULL, DEFAULT GETUTCDATE() | |

---

### `Devices`
One row per physical device ever seen. Upserted by the agent on every connect/change.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `Id` | `int` | PK, IDENTITY | |
| `Udid` | `nvarchar(100)` | UNIQUE, NOT NULL | ADB serial (Android) or UDID (iOS) |
| `Platform` | `nvarchar(10)` | NOT NULL | `android` \| `ios` |
| `AgentId` | `int` | FK → `Agents.Id` | Last known managing agent |
| `State` | `nvarchar(50)` | NOT NULL | `device`, `disconnected`, `Connected`, etc. |
| `Manufacturer` | `nvarchar(100)` | NULL | Android only (`ro.product.manufacturer`) |
| `Model` | `nvarchar(100)` | NULL | Android model or iOS model identifier |
| `OsVersion` | `nvarchar(50)` | NULL | Android release string or iOS version |
| `SdkVersion` | `nvarchar(20)` | NULL | Android SDK level (integer as string) |
| `CpuAbi` | `nvarchar(50)` | NULL | Android only (`ro.product.cpu.abi`) |
| `WifiInterface` | `nvarchar(50)` | NULL | Android only (`wifi.interface`) |
| `IpAddresses` | `nvarchar(1000)` | NULL | JSON: `[{"iface":"wlan0","ipv4":"...","ipv6":"..."}]` |
| `DeviceName` | `nvarchar(100)` | NULL | iOS display name |
| `RawProps` | `nvarchar(1000)` | NULL | Full JSON snapshot of the descriptor from the agent |
| `Tags` | `nvarchar(500)` | NULL | JSON array of string tags; set by operators via API |
| `Notes` | `nvarchar(1000)` | NULL | Freetext; set by operators via API |
| `FirstSeenAt` | `datetime2` | NOT NULL | Set on first INSERT |
| `LastSeenAt` | `datetime2` | NOT NULL | Updated on every upsert |
| `LastStateChangeAt` | `datetime2` | NULL | Updated when `State` changes |

---

### `Platforms`
Lookup table for social/service platforms.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `Id` | `int` | PK, IDENTITY | |
| `Name` | `nvarchar(50)` | UNIQUE, NOT NULL | e.g. `facebook`, `tiktok`, `google`, `youtube`, `instagram`, `twitter` |
| `DisplayName` | `nvarchar(100)` | NOT NULL | e.g. `Facebook`, `TikTok` |
| `Url` | `nvarchar(100)` | NOT NULL | e.g. `facebook.com`, `tiktok.com` |

**Seed data:** facebook, tiktok, google, youtube, instagram, twitter/X

---

### `Accounts`
A social/platform account managed on one or more devices.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `Id` | `int` | PK, IDENTITY | |
| `PlatformId` | `int` | FK → `Platforms.Id`, NOT NULL | |
| `Uuid` | `uniqueidentifier` | NOT NULL | Platform-specific UUID |
| `Username` | `nvarchar(200)` | NOT NULL | Platform username / handle |
| `Password` | `nvarchar(255)` | NOT NULL | Encrypted password |
| `DisplayName` | `nvarchar(200)` | NULL | |
| `Email` | `nvarchar(200)` | NULL | |
| `Phone` | `nvarchar(50)` | NULL | |
| `Status` | `nvarchar(50)` | NOT NULL, DEFAULT 'active' | `active`, `suspended`, `banned`, `inactive` |
| `Notes` | `nvarchar(1000)` | NULL | |
| `CreatedAt` | `datetime2` | NOT NULL, DEFAULT GETUTCDATE() | |
| `UpdatedAt` | `datetime2` | NOT NULL, DEFAULT GETUTCDATE() | |
| `LastLoginAt` | `datetime2` | NULL, DEFAULT GETUTCDATE() | |
| `LastActivityAt` | `datetime2` | NULL, DEFAULT GETUTCDATE() | |

---

### `DeviceAccounts`
Join table — records which accounts are (or were) assigned to which devices.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `Id` | `int` | PK, IDENTITY | |
| `DeviceId` | `int` | FK → `Devices.Id`, NOT NULL | |
| `AccountId` | `int` | FK → `Accounts.Id`, NOT NULL | |
| `AssignedAt` | `datetime2` | NOT NULL, DEFAULT GETUTCDATE() | |
| `UnassignedAt` | `datetime2` | NULL | NULL = currently active assignment |
| `AssignedBy` | `int` | FK → `Users.Id`, NULL | Operator who made the assignment |
| `Notes` | `nvarchar(1000)` | NULL | |

**Index:** `(DeviceId, AccountId, UnassignedAt)` — supports "current accounts on device" queries.

---

### `Users`
Internal operator accounts for the management system.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `Id` | `int` | PK, IDENTITY | |
| `Username` | `nvarchar(100)` | UNIQUE, NOT NULL | |
| `PasswordHash` | `nvarchar(255)` | NOT NULL | bcrypt hash |
| `Role` | `nvarchar(50)` | NOT NULL | `admin`, `operator` |
| `IsActive` | `bit` | NOT NULL, DEFAULT 1 | |
| `CreatedAt` | `datetime2` | NOT NULL, DEFAULT GETUTCDATE() | |
| `LastLoginAt` | `datetime2` | NULL | |

---

### `DeviceSessionLog`
Append-only audit log of device state transitions.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `Id` | `bigint` | PK, IDENTITY | |
| `DeviceId` | `int` | FK → `Devices.Id`, NOT NULL | |
| `AgentId` | `int` | FK → `Agents.Id`, NULL | Which agent reported this |
| `Event` | `nvarchar(100)` | NOT NULL | `connected`, `disconnected`, `state_changed` |
| `OldState` | `nvarchar(50)` | NULL | |
| `NewState` | `nvarchar(50)` | NULL | |
| `OccurredAt` | `datetime2` | NOT NULL, DEFAULT GETUTCDATE() | |

---

## Entity Relationships

```
Agents ──< Devices ──< DeviceAccounts >── Accounts >── Platforms
                             │
                         (AssignedBy)
                             ↓
                           Users

Devices ──< DeviceSessionLog
```

## Indexes (beyond PKs and UNIQUEs)

| Table | Index | Purpose |
|---|---|---|
| `Devices` | `IX_Devices_AgentId` | Filter devices by agent |
| `Devices` | `IX_Devices_State` | Filter online/offline |
| `Devices` | `IX_Devices_Platform` | Filter android/ios |
| `DeviceAccounts` | `IX_DA_DeviceId_Active` on `(DeviceId, UnassignedAt)` | Current assignments |
| `DeviceAccounts` | `IX_DA_AccountId` | All devices an account is on |
| `DeviceSessionLog` | `IX_DSL_DeviceId_OccurredAt` | Per-device history queries |
| `Accounts` | `IX_Accounts_PlatformId_Status` | Filter by platform + status |

## Migrations

Managed by EF Core (in `PhoneFarm.Infrastructure`). The agent uses raw SQL for its upsert writes and does not participate in migrations.
