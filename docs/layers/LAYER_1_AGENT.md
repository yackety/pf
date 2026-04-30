# Layer 1 — Node.js Local Agent

## Purpose

The Node.js server is the **local agent** that runs alongside the physical Android/iOS devices. It is the existing `server/` app, extended with the ability to write device data into MSSQL. It acts as the ADB/WDA bridge and as a command proxy target for the .NET Core API.

## Key Characteristics

| Property | Value |
|---|---|
| Location | Same host as physical devices |
| Tech stack | Node.js, TypeScript, ADB, WDA (appium-xcuitest-driver) |
| DB access | Writes only — upserts device state into MSSQL |
| Exposes | HTTP + WebSocket API (for React client and .NET Core proxy) |
| Config file | `config.yaml` |

## Responsibilities

### Existing (unchanged)
- Manage ADB connections for Android devices via `adb` binary
- Manage WDA sessions for iOS devices
- Emit `DeviceTrackerEvent` on connect / disconnect / state change
- Stream H.264 video frames to connected React clients via WebSocket
- Handle control commands (touch, keyevent, swipe, shell) from React client
- Serve file browser API for React client

### New — DB Integration
- On startup: register/update this agent's record in the `Agents` table (agentId, host URL)
- Send periodic heartbeat to update `Agents.LastHeartbeatAt`
- On every `DeviceTrackerEvent`: upsert the `Devices` row in MSSQL with full properties
- On device disconnect: update `Devices.State` and append a row to `DeviceSessionLog`

## DB Write Points

| Trigger | Table | Action |
|---|---|---|
| Agent startup | `Agents` | INSERT or UPDATE agent record |
| Heartbeat (every 30s) | `Agents` | UPDATE `LastHeartbeatAt`, `IsOnline = 1` |
| Device connected | `Devices` | UPSERT all properties; log `connected` event |
| Device state change | `Devices` | UPDATE `State`, `LastStateChangeAt`; log event |
| Properties refresh (every 60s) | `Devices` | UPDATE `RawProps`, `LastSeenAt`, IP addresses |
| Device disconnected | `Devices` | UPDATE `State = 'disconnected'`; log `disconnected` event |
| Agent shutdown | `Agents` | UPDATE `IsOnline = 0` |

## Config Additions (`config.yaml`)

```yaml
database:
  connectionString: "Server=HOST;Database=PhoneFarm;User Id=...;Password=...;Encrypt=false"

agent:
  id: "agent-office-01"          # unique identifier for this physical host
  host: "http://192.168.1.10:11000"  # URL the .NET Core API will call to proxy commands
  heartbeatIntervalSeconds: 30
  propertiesRefreshIntervalSeconds: 60
```

## Device Properties Captured

### Android (`GoogDeviceDescriptor`)
| Property | Source |
|---|---|
| `udid` | ADB serial number |
| `ro.product.manufacturer` | ADB shell getprop |
| `ro.product.model` | ADB shell getprop |
| `ro.build.version.release` | ADB shell getprop |
| `ro.build.version.sdk` | ADB shell getprop |
| `ro.product.cpu.abi` | ADB shell getprop |
| `wifi.interface` | ADB shell getprop |
| `interfaces` | Network interface enumeration (IP addresses) |
| `pid` | scrcpy server PID |
| `last.update.timestamp` | Local timestamp |

### iOS (`ApplDeviceDescriptor`)
| Property | Source |
|---|---|
| `udid` | iOS device UDID |
| `name` | Device display name |
| `model` | Device model identifier |
| `version` | iOS version string |
| `last.update.timestamp` | Local timestamp |

## HTTP API Endpoints (consumed by .NET Core proxy)

| Method | Route | Description |
|---|---|---|
| GET | `/api/devices` | List currently connected devices |
| POST | `/api/devices/{udid}/action` | Execute a control action on a device |
| GET | `/api/devices/{udid}/screenshot` | Take screenshot, return image |
| WS | `/` | WebSocket multiplexer (video + control) |

## Implementation Notes

- DB writes use the `mssql` npm package (or `tedious`) directly — no ORM needed for a simple upsert pattern
- All DB writes are fire-and-forget with error logging; a DB failure must never crash the agent or interrupt streaming
- The agent does **not** read from the DB — it is write-only to MSSQL
- Connection pooling: single shared SQL connection pool, max 5 connections
