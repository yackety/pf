# Running flows locally

This document covers everything needed to run Appium automation flows on a locally connected device or simulator.

---

## Prerequisites

| Tool | Install |
|------|---------|
| **Node.js** ≥ 18 | `nvm install 18` |
| **Appium v2** | `npm install -g appium` |
| **UiAutomator2 driver** (Android) | `appium driver install uiautomator2` |
| **XCUITest driver** (iOS) | `appium driver install xcuitest` |
| **adb** (Android) | Android Studio → SDK Platform-Tools |
| **Xcode** ≥ 14 + Command Line Tools (iOS) | Mac App Store |
| **iOS device trusted** | `xcrun devicectl list devices` |

Verify Appium setup:
```bash
appium doctor --unsafe
```

---

## Quick start

### 1. Configure your device

Edit `e2e/device-pool.config.yml` and add your device UDID:

```yaml
devices:
  - udid: <your-device-udid>   # iOS: xcrun devicectl list devices
                               # Android: adb devices
    platform: ios              # or android
    osVersion: "17.4"
    tags: [local]
```

> **UDIDs are never placed inside flow YAML files.** They belong only in `device-pool.config.yml` (or passed via `DEVICE_UDID` for one-off runs).

### 2. Create a flow

Add a file under `flows/`. A minimal iOS login flow looks like:

```yaml
appId: com.example.MyApp
platform: ios
name: Login Flow
timeout: 10000
---
- launchApp
- tapOn: "Username"
- inputText: "$TEST_USERNAME"
- tapOn: "Password"
- inputText: "$TEST_PASSWORD"
- tapOn: "Login"
- assertVisible: "Home"
```

`$TEST_USERNAME` / `$TEST_PASSWORD` are resolved from environment variables at run time.

### 3. Run all flows

```bash
npm run flow:test
```

### 4. Run a single flow

```bash
# by file pattern
DEVICE_UDID=<udid> npx jest --config e2e/jest.config.ts -t "Login Flow"

# run all flows on a specific device (bypasses pool allocation)
DEVICE_UDID=<udid> npm run flow:test:band
```

### 5. Watch mode (re-runs on file save)

```bash
DEVICE_UDID=<udid> npm run flow:watch
```

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DEVICE_UDID` | Pin every flow to a specific device, bypassing pool allocation |
| `DEVICE_COUNT` | Number of Jest workers (= parallel devices). Default: `1` |
| Any `$VAR` used inside a flow | Interpolated at parse time; set in shell or in the flow's `env:` block |

---

## How to add a new flow

1. Create `flows/<name>.yml`
2. Write a header block (above `---`) with at minimum `appId` and `platform`
3. Write step list below `---` — see all supported step kinds in [specs/tasks.md](specs/tasks.md) §Phase 2
4. **Do not add `udid:` to the file** — pass it at runtime via `DEVICE_UDID`
5. Run: `DEVICE_UDID=<udid> npm run flow:test:band`

---

## Outputs

| Path | Contents |
|------|----------|
| `e2e/logs/run-<runId>.jsonl` | Per-step structured log (JSONL) |
| `e2e/screenshots/<runId>/FAIL_<kind>_<ts>.png` | Failure screenshots |
| `e2e/videos/<runId>/screen.mp4` | Screen recording (requires `video: true` in flow header) |
| `e2e/reports/junit.xml` | JUnit XML for CI |
| `e2e/reports/report.html` | HTML report |

All output directories are `.gitignore`d. The self-healing selector cache at `.cache/selectors.json` **is** committed.

---

## Troubleshooting

**Appium fails to start**
```bash
# Check the per-device log
cat e2e/logs/appium-<udid>.log
```

**WDA install timeout (iOS)**
- Increase `wdaLaunchTimeout` in `SessionManager.ts` (default 60 s)
- Ensure the device is trusted and Xcode can build for it: `xcodebuild -showsdks`

**Element not found**
- The self-healing cache `.cache/selectors.json` stores winning selectors between runs
- Delete it to force a full re-probe: `rm .cache/selectors.json`
- Run with `--verbose` to see selector strategy attempts in the JSONL log
