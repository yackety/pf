# Layer 0 — React Client (Local Admin Viewer)

## Purpose

The React client is the **on-site administrator's tool** for real-time device screen streaming and direct control. It runs on the same machine (or LAN segment) as the Node.js agent. It is the existing `client/` Vite + React app — no changes to its core purpose are planned.

## Key Characteristics

| Property | Value |
|---|---|
| Location | Same host or LAN as the agent |
| Auth | None — trusted local network |
| Data source | Node.js agent WebSocket + HTTP **directly** |
| Purpose | Live stream view + real-time device control |
| Tech stack | React 18, Vite, TypeScript, WebCodecs API, Canvas |
| Access | Local only — not exposed to the internet |

## Responsibilities

- Connect to the Node.js agent via WebSocket for low-latency H.264 / WebCodecs video stream
- Render all connected devices as live video tiles in a responsive grid
- Send touch, keyboard, and hardware-key control events back to the agent in real time
- Provide quick-action buttons per device: Home, Back, Power, Volume, Screenshot
- Multi-device sync input via `SyncPanel` (broadcast same action to multiple devices simultaneously)
- Navigate to per-device Shell and File Browser pages

## Pages & Components

| Route / Component | Description |
|---|---|
| `/` — `App.tsx` | Main tile grid — all connected devices rendered as live video tiles |
| `DeviceViewer.tsx` | Full-screen single-device stream with touch overlay and control bar |
| `ShellPage.tsx` | ADB shell terminal (xterm.js) for a selected device |
| `FileListingPage.tsx` | Browse device filesystem; upload/download files via ADB |
| `SyncPanel.tsx` | Sidebar panel to select devices for synchronized input |
| `HeaderBar.tsx` | Top bar: bitrate control, grid layout toggle, connection status |
| `RightBar.tsx` | Collapsed/expanded sidebar with device list and quick actions |

## Communication with Agent

```
React Client
    │
    ├── WebSocket ws://{agentHost}/  ──→  video stream frames (H.264 NAL units)
    ├── HTTP GET  /api/devices        ──→  device list + state
    ├── HTTP POST /api/action/{udid}  ──→  control commands (keyevent, touch, swipe)
    └── HTTP GET  /api/shell/{udid}   ──→  shell session upgrade (WebSocket)
```

## What This Layer Does NOT Do

- Does **not** read from or write to MSSQL
- Does **not** call the .NET Core Management API
- Does **not** manage accounts, users, or business data
- Does **not** require authentication (local trust boundary)

## Future Considerations

If multi-site access is ever needed (viewing a remote agent's stream), the .NET Core API can act as a WebSocket proxy — but this is out of scope for the current plan. The React client remains a purely local tool.
