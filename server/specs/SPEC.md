# Appium Flow Runner — Full Specification (Production Edition)

Run Maestro-style YAML flows either as Jest e2e tests or via an HTTP API call —
with parallel multi-device execution, smart waits, self-healing selectors, and CI-ready reporting.

---

## 1. Concept

Each YAML file describes one user flow (login, checkout, onboarding, …).
The **runner core is a framework-agnostic shared library** (`src/flow-runner/`).
Two consumers sit on top of it: the Jest e2e test runner and the HTTP API server.
This means the exact same flow can be triggered by a developer running `jest`, by CI, or by an API call
from a dashboard / webhook — without duplicating any logic.

### Architecture (v3 — Shared Core)

```
flows/login.yml   (source-controlled YAML, shared by both consumers)
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/flow-runner/          ← framework-agnostic shared library  │
│                                                                 │
│  FlowParser        yaml string → { header, steps }             │
│  EnvInterpolator   $VAR substitution                           │
│  DevicePool        acquire / release devices                   │
│  AppiumServerMgr   spawn appium per device, auto-port          │
│  SessionManager    createSession / destroySession              │
│  StepExecutor      retry wrapper → handler → result            │
│  StepHandlerRegistry  plugin registry (one file per category)  │
│  SelectorResolver  8-strategy element lookup                   │
│  SelfHealingCache  persist winning selectors                   │
│  types.ts          FlowHeader, FlowStep, StepResult, …         │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌──────────────────────────────────┐
│  e2e/           │          │  src/server/services/HttpServer  │
│  (Jest wrapper) │          │  POST /api/flow/run              │
│                 │          │  POST /api/flow/run-file         │
│  globalSetup    │          │  GET  /api/flow/status/:runId    │
│  spec file      │          │  GET  /api/flow/result/:runId    │
│  reporters      │          └──────────────────────────────────┘
└─────────────────┘
         │                              │
         └──────────────┬───────────────┘
                        ▼
               AppiumServer(:47xx)
               ├── UIAutomator2 (Android)
               └── XCUITest     (iOS)
```

### Why Not Put the Runner Under `e2e/`?

`e2e/` is a Jest-specific folder. Importing from `e2e/runner/FlowParser` inside
`src/server/services/HttpServer.ts` would make the API server depend on the test folder —
a backwards dependency that breaks the build boundary and confuses `tsconfig` include paths.

`src/flow-runner/` is already inside the server's `tsconfig.json` `include` paths
(`src/**/*`) so it compiles together with the rest of the server code with zero extra config.

### ⚠️ Critical Problems with v1 (still applies)

1. **Single Appium server on :4723** — all parallel workers collide on the same port.
2. **Hardcoded `udid` in YAML** — breaks CI matrices and multi-device runs.
3. **One `describe` block owns a session** — `beforeAll` failure cascades to all steps.
4. **Hard `wait: N` everywhere** — arbitrary sleeps slow every flow.
5. **`stepHandlers.ts` as a single file** — merge-conflict magnet at scale.
6. **No retry** — one flaky animation fails the whole flow permanently.
7. **No video capture** — screenshots alone are insufficient for race condition diagnosis.
8. **`globalSetup` starts one Appium** — does not scale beyond one device.

---

## 2. YAML Format

### ⚠️ Risk: Hardcoded UDIDs Are a CI Anti-Pattern

The v1 format requires `udid: 00008110-001234ABCDEF` directly in the YAML.
This means the same flow file cannot be used across different devices or in a CI matrix without forking the file.
**Solution:** Make `udid` optional. When absent, the DevicePool allocates a suitable device at runtime based on `platform` and optional `tags`.

### Header (before `---`)

| Key | Required | Description |
|-----|----------|-------------|
| `appId` | ✅ | Bundle ID / package name |
| `platform` | ✅ | `android` \| `ios` |
| `name` | ❌ | Human-readable suite name (defaults to filename) |
| `udid` | ❌ | **Never hardcode in committed flow files.** Omit to use pool allocation. Supply at runtime via env var `DEVICE_UDID`, API request body field `udid`, or `device-pool.config.yml`. |
| `tags` | ❌ | Device selector tags e.g. `[ios17, iphone15]` — matched against pool |
| `timeout` | ❌ | Per-step element-wait timeout in ms (default `10000`) |
| `resetApp` | ❌ | `true` = terminate + clear state before run (default `false`) |
| `retries` | ❌ | Flow-level retry count on total failure (default `0`) |
| `stepRetries` | ❌ | Per-step retry count on flaky steps (default `1`) |
| `video` | ❌ | `true` = record screen for the full flow (default `false`) |
| `env` | ❌ | Key-value map of variables interpolated into step values |

> **Rule: `udid` must never be committed inside a `flows/*.yml` file.**
> Device identity is infrastructure, not test data. Flows describe *what* to do; the pool decides *which device* to run on.
> Supply it at runtime through one of three channels:
> 1. **Device pool** (preferred): omit `udid` — `DevicePool.acquire()` picks the first free device matching `platform` + `tags`.
> 2. **Env var** (single-device dev/CI): `DEVICE_UDID=00008110-ABC123 npx jest ...` — `DevicePool` reads this and pins allocation.
> 3. **API request body** (HTTP trigger): pass `"udid": "emulator-5554"` in the POST body — `FlowParser.parse(yaml, { udid })` injects it as an override.

### Steps (after `---`)

Steps are a YAML sequence. Each item is either a **shorthand string** or a **key-value map**.
String values support `$VAR` interpolation from the `env` block or environment variables.

```yaml
appId: com.example.app
platform: ios
name: Login Flow
tags: [ios17]          # pool picks a free iOS 17 device — no udid here
retries: 1
stepRetries: 2
video: true
env:
  USERNAME: testuser
  PASSWORD: password123
---
- launchApp
- tapOn: "Username"
- inputText: "$USERNAME"
- tapOn: "Password"
- inputText: "$PASSWORD"
- tapOn: "Submit"
- assertVisible: "Welcome"
```

> `env` values can also be overridden at runtime via environment variables, enabling the same YAML
> to run against staging vs production without any file changes.
> `udid` is intentionally absent — device selection happens through the pool or the `DEVICE_UDID` env var.

---

## 3. Supported Steps

### ⚠️ Risk: `wait: N` Should Be a Last Resort

Hard sleeps are the #1 cause of slow, flaky tests. Replace every `wait` with a condition-based step where possible.
`wait` is kept for cases where there is genuinely no observable UI signal (e.g., a network cache warming).

### App Lifecycle

| Step | Example | Notes |
|------|---------|-------|
| `launchApp` | `- launchApp` | `activateApp` — does NOT reset state |
| `restartApp` | `- restartApp` | `terminateApp` + `activateApp` |
| `clearApp` | `- clearApp` | Clears storage; Android only via `mobile: clearApp` |
| `stopApp` | `- stopApp` | `terminateApp` |

### Element Interaction

| Step | Example | Notes |
|------|---------|-------|
| `tapOn: <text>` | `- tapOn: "Submit"` | Resolved via SelectorResolver (see §9) |
| `tapOn: { id }` | `- tapOn: {id: "btn_login"}` | Resource-id (Android) / name (iOS) |
| `tapOn: { xpath }` | `- tapOn: {xpath: "//XCUIElementTypeButton[@name='OK']"}` | Raw XPath — brittle, last resort |
| `tapOn: { testId }` | `- tapOn: {testId: "submit-btn"}` | `data-testid` / `accessibilityIdentifier` — **preferred** |
| `longPressOn: <text>` | `- longPressOn: "Item"` | Long-press (1500 ms) |
| `doubleTapOn: <text>` | `- doubleTapOn: "Image"` | Double-tap |
| `inputText: <text>` | `- inputText: "hello"` | Types into focused field via `setValue` (one round-trip, not key-by-key) |
| `clearText` | `- clearText` | Clears focused field |
| `hideKeyboard` | `- hideKeyboard` | Soft keyboard dismiss |
| `scroll: down` | `- scroll: down` | Direction: `up \| down \| left \| right` |
| `scrollTo: <text>` | `- scrollTo: "Terms of Service"` | Scrolls until element is visible — avoids guessing scroll count |
| `swipe: {from, to}` | `- swipe: {from: [500,1400], to: [500,400]}` | Pixel coordinates |

### Assertions

| Step | Example | Notes |
|------|---------|-------|
| `assertVisible: <text>` | `- assertVisible: "Welcome"` | Fails if not found within `timeout` |
| `assertNotVisible: <text>` | `- assertNotVisible: "Error"` | Fails if element IS found |
| `assertChecked: <text>` | `- assertChecked: "Remember me"` | Toggle/checkbox is on |
| `assertEqual: {id, value}` | `- assertEqual: {id: "label", value: "OK"}` | Element text equals value |
| `waitForVisible: <text>` | `- waitForVisible: "Dashboard"` | Blocks until visible, does not fail (use before dependent steps) |
| `waitForNotVisible: <text>` | `- waitForNotVisible: "Loading..."` | Blocks until gone — **preferred over `wait: N`** |

### Device / Host

| Step | Example | Notes |
|------|---------|-------|
| `wait: <ms>` | `- wait: 1500` | Hard pause — use sparingly, prefer `waitForNotVisible` |
| `back` | `- back` | Android BACK keycode / iOS native back gesture |
| `home` | `- home` | Press HOME |
| `screenshot: <name>` | `- screenshot: after-login` | Jest: `e2e/screenshots/<runId>/<name>.png` · API: `artifacts/<runId>/screenshots/<name>.png` |
| `runScript: <file>` | `- runScript: scripts/seed.sh` | Shell script on host machine — output captured in step result |

---

## 4. File & Folder Layout

```
src/
  flow-runner/                   ← shared library (no Jest/Express imports)
    types.ts                     ← FlowHeader, FlowStep, StepResult, DeviceRecord, RunResult
    FlowParser.ts                ← YAML string → { header, steps }
    EnvInterpolator.ts           ← $VAR substitution
    StepHandlerRegistry.ts       ← plugin registry
    StepExecutor.ts              ← retry wrapper, screenshot on failure
    SessionManager.ts            ← createSession / destroySession (WebdriverIO)
    SelectorResolver.ts          ← 8-strategy element lookup
    SelfHealingCache.ts          ← .cache/selectors.json read/write
    pool/
      DevicePool.ts              ← acquire() / release() with async locking
      DeviceRecord.ts            ← { udid, platform, osVersion, tags, appiumPort }
      AppiumServerManager.ts     ← spawn/kill appium per device, portfinder
    handlers/                    ← one file per step category
      lifecycle.ts               ← launchApp, restartApp, clearApp, stopApp
      interaction.ts             ← tapOn, inputText, scroll, swipe, …
      assertions.ts              ← assertVisible, assertEqual, …
      device.ts                  ← wait, back, home, screenshot, runScript

  server/
    services/
      HttpServer.ts              ← adds /api/flow/* routes (imports from flow-runner)

e2e/                             ← Jest wrapper only (no business logic)
  jest.config.ts
  tsconfig.json
  device-pool.config.yml         ← device inventory (UDIDs here, NOT in flow files)
  setup/
    globalSetup.ts               ← start per-device Appium servers, pre-warm sessions
    globalTeardown.ts            ← stop Appium servers, flush reports
  AppiumFlowRunner.spec.ts       ← dynamic test generator (globs flows/)
  reporter/
    StepReporter.ts              ← custom Jest reporter (step table, embedded screenshots)
  screenshots/                   ← auto-created; gitignored
    <runId>/
      <name>.png                 ← from `screenshot: <name>` step
      FAIL_<kind>_<ts>.png       ← auto-captured on step failure
  videos/                        ← auto-created; gitignored
    <runId>/
      screen.mp4                 ← when `video: true`
  logs/                          ← auto-created; gitignored
    appium-<udid>.log            ← Appium server stdout/stderr (one per device)
    run-<runId>.jsonl            ← per-step structured log (JSONL)
  reports/                       ← auto-created; gitignored
    junit.xml                    ← for CI systems
    report.html                  ← human-readable HTML

flows/                           ← YAML flow files (shared by e2e AND API)
  login.yml                      ← NO udid field; device supplied at runtime
  *.yml

artifacts/                       ← API run outputs (auto-created; gitignored)
  <runId>/
    screenshots/
      <name>.png                 ← from `screenshot: <name>` step
      FAIL_<kind>_<ts>.png       ← auto-captured on step failure
    videos/
      screen.mp4                 ← when `video: true`
    run.jsonl                    ← per-step structured log (JSONL)

logs/                            ← API Appium server logs (auto-created; gitignored)
  appium-<udid>.log              ← one file per device managed by API

specs/
  SPEC.md                        ← this document

.cache/
  selectors.json                 ← self-healing selector cache (COMMIT to repo)
```

### Artifact Directories — Canonical Paths

All runtime-generated files live under explicitly scoped roots. Neither the test suite nor the API
should scatter files in ad-hoc locations.

#### Jest e2e consumer (`e2e/`)

| What | Path | Auto-created? | Gitignored? |
|------|------|:---:|:---:|
| Named screenshot | `e2e/screenshots/<runId>/<name>.png` | ✅ | ✅ |
| Failure screenshot | `e2e/screenshots/<runId>/FAIL_<kind>_<ts>.png` | ✅ | ✅ |
| Screen recording | `e2e/videos/<runId>/screen.mp4` | ✅ | ✅ |
| Per-step JSONL log | `e2e/logs/run-<runId>.jsonl` | ✅ | ✅ |
| Appium server log | `e2e/logs/appium-<udid>.log` | ✅ | ✅ |
| JUnit XML report | `e2e/reports/junit.xml` | ✅ | ✅ |
| HTML report | `e2e/reports/report.html` | ✅ | ✅ |

#### HTTP API consumer (`artifacts/`, `logs/`)

| What | Path | Auto-created? | Gitignored? | Served via |
|------|------|:---:|:---:|----|
| Named screenshot | `artifacts/<runId>/screenshots/<name>.png` | ✅ | ✅ | `GET /api/flow/artifact/:runId/screenshots/<name>.png` |
| Failure screenshot | `artifacts/<runId>/screenshots/FAIL_<kind>_<ts>.png` | ✅ | ✅ | same |
| Screen recording | `artifacts/<runId>/videos/screen.mp4` | ✅ | ✅ | `GET /api/flow/artifact/:runId/videos/screen.mp4` |
| Per-step JSONL log | `artifacts/<runId>/run.jsonl` | ✅ | ✅ | `GET /api/flow/artifact/:runId/run.jsonl` |
| Appium server log | `logs/appium-<udid>.log` | ✅ | ✅ | not served |

#### Shared (committed to repo)

| What | Path | Notes |
|------|------|-------|
| Self-healing selector cache | `.cache/selectors.json` | Commit — grows more accurate over time |
| Flow files | `flows/*.yml` | No `udid` field — device is runtime input |
| Device pool config | `e2e/device-pool.config.yml` | UDIDs live here, not in flow files |

### Key Boundary Rules

- **`src/flow-runner/`** imports only: `webdriverio`, `yaml`, `portfinder`, `p-limit`, `tesseract.js` (optional). No `express`, no `jest`.
- **`e2e/`** imports from `src/flow-runner/` and `jest`. Nothing else.
- **`src/server/`** imports from `src/flow-runner/` and `express`. No `jest`.
- **`flows/`** is pure data (YAML). No code, no coupling.

This means `flows/login.yml` can be run by both:
```bash
npx jest --config e2e/jest.config.ts --testPathPattern login   # developer / CI
curl -X POST http://localhost:11000/api/flow/run-file \
     -d '{"path":"flows/login.yml","udid":"emulator-5554"}'    # API / dashboard
```

### ⚠️ Risk: Single `stepHandlers.ts` Does Not Scale

The v1 design puts all step implementations in one file. At ~20+ step types this becomes a 500+ line
merge-conflict magnet. The v2 `handlers/` directory splits by category; `StepHandlerRegistry` maps
step type names to their implementations at startup.

```ts
// StepHandlerRegistry.ts
type StepHandler = (ctx: StepContext) => Promise<void>;
const registry = new Map<string, StepHandler>();

export const register = (name: string, fn: StepHandler) => registry.set(name, fn);
export const resolve  = (name: string): StepHandler => {
  const h = registry.get(name);
  if (!h) throw new Error(`Unknown step type: "${name}". Register it in handlers/.`);
  return h;
};

// handlers/lifecycle.ts — registers itself on import
import { register } from '../StepHandlerRegistry';
register('launchApp', async ({ driver, header }) => {
  await driver.activateApp(header.appId);
});
```

Adding a new step = one new `register()` call in the right category file. No core files touched.

---

## 5. Device Pool & Parallel Execution

### ⚠️ Risk: Jest `--maxWorkers` + Single Appium Port = Race Condition

Jest runs each test file in a separate worker process. If all workers call `remote({ port: 4723 })`,
they share one Appium server. On concurrent flow runs, sessions will mix, steps will target the wrong device,
and failures will be non-deterministic and impossible to diagnose.

### Device Pool Config (`e2e/device-pool.config.yml`)

```yaml
devices:
  - udid: 00008110-ABC123
    platform: ios
    osVersion: "17.4"
    tags: [iphone15, ios17]

  - udid: 00008110-DEF456
    platform: ios
    osVersion: "16.7"
    tags: [iphone13, ios16]

  - udid: emulator-5554
    platform: android
    osVersion: "14"
    tags: [pixel7, android14]
```

### How Pool Allocation Works

`globalSetup.ts` reads the pool config and:

1. For each device, spawns `appium --port <auto>` as a child process.
2. Writes `{ udid → port }` into a shared file (`/tmp/appium-ports-<runId>.json`) that worker processes can read.
3. Creates an async semaphore per device so only one Jest worker uses a given device at a time.

```ts
// pool/AppiumServerManager.ts (sketch)
import { getPort } from 'portfinder';   // already in package.json deps

export async function spawnForDevice(udid: string): Promise<number> {
  const port = await getPort({ port: 4723 });
  const proc = spawn('appium', ['--port', String(port), '--log-level', 'warn'], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForAppiumReady(port);          // poll /status until 200
  portMap.set(udid, { port, proc });
  return port;
}
```

### Flow → Device Matching

When a flow's header has no `udid`, `DevicePool.acquire(tags, platform)` returns the first free device
matching all tags. The Jest worker holds the lock until `afterAll` calls `DevicePool.release(udid)`.

```ts
// pool/DevicePool.ts (sketch)
export async function acquire(platform: string, tags: string[]): Promise<DeviceRecord> {
  const candidates = devices.filter(d =>
    d.platform === platform && tags.every(t => d.tags.includes(t))
  );
  // spin-wait with backoff — max 60s before failing the test suite
  for (const d of candidates) {
    if (await lock.tryAcquire(d.udid)) return d;
  }
  throw new Error(`No free device found for platform=${platform} tags=${tags.join(',')}`);
}
```

### Jest Worker Configuration

```ts
// jest.config.ts
export default {
  maxWorkers: process.env.DEVICE_COUNT ?? 3,  // match your device pool size
  testTimeout: 300_000,                        // 5 min per flow (real devices are slow)
  globalSetup:    './setup/globalSetup.ts',
  globalTeardown: './setup/globalTeardown.ts',
};
```

> **Rule:** `maxWorkers` must never exceed the number of devices in the pool.
> Exceeded workers will deadlock waiting for a device and eventually timeout.

---

## 5b. How Tests Are Generated

`e2e/AppiumFlowRunner.spec.ts` is a single Jest file that:

1. Globs `flows/**/*.yml` (the shared flows directory)
2. For each file calls `FlowParser.parse(content)` to get `{ header, steps }`
3. Wraps in `describe(name)` → `it(step description)`
4. Acquires one device per `describe` block (in `beforeAll`), releases in `afterAll`

```ts
// e2e/AppiumFlowRunner.spec.ts
const flows = glob.sync('flows/**/*.yml');  // ← shared flows/, not e2e/flows/
  const { header, steps } = FlowParser.parse(fs.readFileSync(flowFile, 'utf8'));

  describe(header.name ?? path.basename(flowFile), () => {
    let driver: WebdriverIO.Browser;
    let device: DeviceRecord;

    beforeAll(async () => {
      device = await DevicePool.acquire(header.platform, header.tags ?? []);
      driver = await SessionManager.create(header, device);
    });

    afterAll(async () => {
      await driver.deleteSession().catch(() => {});
      DevicePool.release(device.udid);
    });

    // Steps are sequential — each it() receives the shared driver
    // but Jest reports them individually
    let previousFailed = false;
    steps.forEach((step, i) => {
      it(`[${i + 1}] ${describeStep(step)}`, async () => {
        if (previousFailed) {
          pending('Previous step failed — skipping dependent step');
          return;
        }
        try {
          await StepExecutor.run(driver, step, header);
        } catch (e) {
          previousFailed = true;
          throw e;
        }
      });
    });
  });
}
```

### ⚠️ Risk: Independent `it()` Blocks on a Shared Session

The original plan has steps as independent `it()` blocks sharing one `driver`. This means:
- If step 3 (`tapOn: "Password"`) fails, steps 4–7 still execute — against a broken UI state.
- The solution is the `previousFailed` guard above, which marks subsequent steps as `pending` rather than letting them run and produce false failures.

The better long-term design is a **flow-as-one-test** model for correctness + **step-level reporting** for observability:

```ts
it('full flow', async () => {
  for (const [i, step] of steps.entries()) {
    try {
      await StepExecutor.run(driver, step, header);
      reporter.stepPassed(i, step);
    } catch (e) {
      reporter.stepFailed(i, step, e);
      throw e;   // fail the parent it()
    }
  }
});
```

Step-level detail then comes from the custom reporter (§10), not from Jest's test tree.

---

## 5c. HTTP API — Running Flows via Endpoint

The same `src/flow-runner/` library is wired into `HttpServer.ts` as four routes.
No Appium or test logic lives in the HTTP layer — it only calls `FlowRunner.run()` and maps results to JSON.

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/flow/run` | Run a flow from an inline YAML string or parsed steps in the request body |
| `POST` | `/api/flow/run-file` | Run a flow from a file path (relative to `flows/`) |
| `GET` | `/api/flow/status/:runId` | Poll status of an async run (pending / running / done / failed) |
| `GET` | `/api/flow/result/:runId` | Retrieve the full `RunResult` (step results, screenshots, duration) |

### `POST /api/flow/run-file`

```jsonc
// Request body
{
  "path": "flows/login.yml",
  "udid": "emulator-5554",      // optional — overrides header.udid / pool
  "env": {                       // optional — merged over header.env
    "USERNAME": "ci-user",
    "PASSWORD": "ci-pass"
  },
  "async": true                  // optional — return runId immediately, poll /status
}

// Response (sync, async: false)
{
  "success": true,
  "runId": "run-1746395000-abc",
  "durationMs": 12340,
  "results": [
    { "step": 1, "action": "launchApp",   "status": "pass", "durationMs": 3100 },
    { "step": 2, "action": "tapOn",       "status": "pass", "durationMs": 134,  "target": "Username" },
    { "step": 3, "action": "inputText",   "status": "pass", "durationMs": 88,   "target": "testuser" },
    { "step": 6, "action": "tapOn",       "status": "fail", "durationMs": 10012,"target": "Submit",
      "error": "Element not found after 10000ms",
      "screenshotUrl": "/api/flow/artifact/run-1746395000-abc/FAIL_tapOn_Submit.png" }
  ]
}

// Response (async: true)
{
  "runId": "run-1746395000-abc",
  "statusUrl": "/api/flow/status/run-1746395000-abc"
}
```

### `POST /api/flow/run` (inline YAML)

```jsonc
{
  "yaml": "appId: com.example.app\nplatform: android\n---\n- launchApp\n- assertVisible: \"Home\"",
  "udid": "emulator-5554"
}
```

Useful for dashboards or automation scripts that generate flows dynamically at runtime.

### Implementation Sketch in `HttpServer.ts`

```ts
// src/server/services/HttpServer.ts (addition)
import { FlowRunner } from '../../flow-runner/FlowRunner';

this.mainApp.post('/api/flow/run-file', async (req, res) => {
  const { path: flowPath, udid, env, async: isAsync } = req.body ?? {};
  if (typeof flowPath !== 'string') return res.status(400).json({ error: '"path" required' });

  const absPath = path.resolve(process.cwd(), flowPath);
  // Prevent path traversal — must stay under flows/
  if (!absPath.startsWith(path.resolve(process.cwd(), 'flows'))) {
    return res.status(400).json({ error: 'Path must be inside flows/' });
  }

  const yaml = await fs.promises.readFile(absPath, 'utf8');
  const { header, steps } = FlowParser.parse(yaml, { env, udid });

  if (isAsync) {
    const runId = FlowRunner.startAsync(header, steps);
    return res.json({ runId, statusUrl: `/api/flow/status/${runId}` });
  }

  const result = await FlowRunner.run(header, steps);
  return res.status(result.success ? 200 : 207).json(result);
});
```

> **Security note:** The path-traversal guard above is mandatory. Never pass user input directly to
> `fs.readFile` without resolving and validating against an allowed base directory.

### `FlowRunner` — the Bridge Between API and Core

```ts
// src/flow-runner/FlowRunner.ts
export class FlowRunner {
  static async run(header: FlowHeader, steps: FlowStep[]): Promise<RunResult> {
    const device = await DevicePool.acquire(header.platform, header.tags ?? [], header.udid);
    const driver = await SessionManager.create(header, device);
    const results: StepResult[] = [];
    try {
      for (const [i, step] of steps.entries()) {
        const r = await StepExecutor.run(driver, step, header);
        results.push(r);
        if (!r.success) break;
      }
    } finally {
      await driver.deleteSession().catch(() => {});
      DevicePool.release(device.udid);
    }
    return { success: results.every(r => r.success), results, durationMs: /* … */ };
  }

  static startAsync(header: FlowHeader, steps: FlowStep[]): string {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    runStore.set(runId, { status: 'running', result: null });
    FlowRunner.run(header, steps)
      .then(r => runStore.set(runId, { status: 'done', result: r }))
      .catch(e => runStore.set(runId, { status: 'failed', error: e.message }));
    return runId;
  }
}
```

---

## 6. Running

```bash
# Install deps first (see §7)
npm install

# Run all flows via Jest (uses device pool)
npx jest --config e2e/jest.config.ts

# Run a specific flow via Jest
npx jest --config e2e/jest.config.ts --testPathPattern "login"

# Run only flows tagged for a specific platform
PLATFORM_FILTER=ios npx jest --config e2e/jest.config.ts

# Debug a single flow (pin to device, single-threaded)
DEVICE_UDID=00008110-ABC123 npx jest --config e2e/jest.config.ts --runInBand --testPathPattern "login"

# Run a flow via the API server (device from pool)
curl -X POST http://localhost:11000/api/flow/run-file \
  -H 'Content-Type: application/json' \
  -d '{"path":"flows/login.yml"}'

# Pin to a specific device via the API request body (dev/debug only)
curl -X POST http://localhost:11000/api/flow/run-file \
  -H 'Content-Type: application/json' \
  -d '{"path":"flows/login.yml","udid":"emulator-5554"}'  # udid here, never in the YAML

# Run a flow asynchronously and poll
RUN=$(curl -s -X POST http://localhost:11000/api/flow/run-file \
  -H 'Content-Type: application/json' \
  -d '{"path":"flows/login.yml","async":true}' | jq -r .runId)
curl http://localhost:11000/api/flow/status/$RUN
```

Appium servers are started per-device by `e2e/setup/globalSetup.ts` for Jest runs,
and lazily by `AppiumServerManager` on the first API call for a given device.

---

## 7. Packages Required

### Runtime (`dependencies`)

| Package | Version | Purpose |
|---------|---------|---------|
| `webdriverio` | `^9.x` | Appium/WebDriver client (TypeScript-first, built-in retry) |
| `yaml` | already in deps | Parse YAML flow files |
| `glob` | `^11.x` | Discover `specs/flows/**/*.yml` |
| `portfinder` | already in deps | Auto-assign Appium server ports |
| `p-limit` | `^6.x` | Concurrency limiter for DevicePool acquire/release |

### Dev (`devDependencies`)

| Package | Version | Purpose |
|---------|---------|---------|
| `jest` | `^29.x` | Test runner |
| `ts-jest` | `^29.x` | TypeScript support without pre-compile step |
| `@types/jest` | `^29.x` | Jest TypeScript types |
| `jest-junit` | `^16.x` | JUnit XML output for CI systems |
| `jest-html-reporters` | `^3.x` | HTML report with screenshots embedded |
| `appium` | `^2.x` | Appium server (can be devDep, spawned by globalSetup) |

### Optional: AI / OCR Fallback (§11)

| Package | Version | Purpose |
|---------|---------|---------|
| `tesseract.js` | `^5.x` | OCR-based element detection from screenshots |
| `openai` | `^4.x` | GPT-4o vision fallback for element identification |

### Appium Drivers (install via `appium driver install`)

| Driver | Platform |
|--------|----------|
| `uiautomator2` | Android — always use latest; significantly faster than `espresso` for text-based lookup |
| `xcuitest` | iOS — already partially wired via WDA in this repo |

### System Prerequisites (macOS)

```bash
# Appium globally (or as devDep and call node_modules/.bin/appium)
npm install -g appium@2
appium driver install uiautomator2
appium driver install xcuitest

# Android
brew install android-platform-tools   # adb
# ~/.zshrc: export ANDROID_HOME=$HOME/Library/Android/sdk
# ~/.zshrc: export JAVA_HOME=$(/usr/libexec/java_home -v 17)

# iOS
xcode-select --install
# Device: Settings → Privacy & Security → Developer Mode → ON
# Trust the Mac on the device when prompted
```

---

## 8. Implementation Order

Each item is independently testable before moving to the next.

1. **`specs/runner/types.ts`** — `FlowHeader`, `FlowStep` union type, `StepResult`, `DeviceRecord`
2. **`specs/runner/FlowParser.ts`** — splits on `---`, parses header + steps, resolves `$VAR` via `EnvInterpolator`
3. **`specs/runner/EnvInterpolator.ts`** — `$VAR` substitution from `header.env` + `process.env`
4. **`src/flow-runner/pool/DevicePool.ts`** + **`AppiumServerManager.ts`** — pool from `e2e/device-pool.config.yml`, port auto-assign
5. **`src/flow-runner/StepHandlerRegistry.ts`** — plugin registry
6. **`src/flow-runner/handlers/lifecycle.ts`** + **`interaction.ts`** + **`assertions.ts`** + **`device.ts`** — register all step types
7. **`src/flow-runner/SelectorResolver.ts`** — multi-strategy lookup (§9)
8. **`src/flow-runner/SelfHealingCache.ts`** — load/save `.cache/selectors.json`
9. **`src/flow-runner/StepExecutor.ts`** — retry wrapper, screenshot on failure, calls registry
10. **`src/flow-runner/SessionManager.ts`** — `createSession(header, device)` with correct capabilities
11. **`src/flow-runner/FlowRunner.ts`** — `run()` + `startAsync()` bridge used by both API and Jest
12. Wire **`POST /api/flow/run-file`** etc. into `src/server/services/HttpServer.ts`
13. **`e2e/setup/globalSetup.ts`** + **`globalTeardown.ts`** — start/stop Appium per device for Jest
14. **`e2e/jest.config.ts`** + **`e2e/tsconfig.json`** — wire everything
15. **`e2e/AppiumFlowRunner.spec.ts`** — dynamic test generator
16. **`flows/login.yml`** — first real flow
17. **`e2e/device-pool.config.yml`** — populated with real device UDIDs

---

## 9. Selector Strategy (Improved)

### ⚠️ Risk: XPath Is Slow and Brittle

XPath traverses the full accessibility tree. On a complex screen this can add 200–800 ms **per step**.
The original v1 uses XPath as a third-priority fallback — this is correct — but it is still hit too often
because `accessibility id` rarely matches plain visible text on Android.

### Unified Selector Model

`SelectorResolver.resolve(driver, target, platform)` runs strategies in this order and stops at the first hit:

| Priority | Strategy | Android selector | iOS selector | Typical latency |
|----------|----------|-----------------|--------------|----------------|
| 1 | `testId` hint | `id: "appId:id/testId"` | `~testId` (accessibility id) | ~50 ms |
| 2 | `id` hint | `id: "appId:id/resId"` | `~name` | ~50 ms |
| 3 | Accessibility label exact | `~text` | `~text` | ~80 ms |
| 4 | UiSelector text (Android) | `-android uiautomator: new UiSelector().text("…")` | — | ~100 ms |
| 5 | iOS predicate string | — | `-ios predicate string: label == "…"` | ~100 ms |
| 6 | XPath compound | `//*[@text='…' or @content-desc='…' or @label='…']` | same | ~300–800 ms |
| 7 | **Self-healing cache** | last known winning selector for this element+appVersion | same | ~50 ms |
| 8 | **OCR / AI fallback** | screenshot → find text region → tap coordinates | same | ~2–5 s |

The winning strategy for step `tapOn: "Submit"` on app version `1.4.2` is written to `.cache/selectors.json`:

```json
{
  "com.example.app@1.4.2": {
    "Submit": { "strategy": "uiautomator", "value": "new UiSelector().text(\"Submit\")", "hitCount": 42 }
  }
}
```

On the next run, strategy 7 (cache) is tried first — effectively making repeated runs faster over time.

### Self-Healing on Selector Failure

When all 6 primary strategies fail:

1. Take a screenshot.
2. Run OCR (`tesseract.js`) over the screenshot to locate the text region.
3. Tap the centroid of the matched bounding box.
4. If the expected next-step element appears, record the coordinates as a `coordinate` strategy in cache.
5. Emit a `SELF_HEAL` warning in the report so a developer can add a proper `testId` to the app.

```ts
// SelectorResolver.ts (sketch)
async function ocrFallback(driver, text): Promise<ElementResult> {
  const screenshot = await driver.takeScreenshot();   // base64
  const { data: { words } } = await Tesseract.recognize(Buffer.from(screenshot, 'base64'));
  const match = words.find(w => w.text.toLowerCase() === text.toLowerCase() && w.confidence > 80);
  if (!match) throw new Error(`OCR could not find "${text}" on screen`);
  const { x0, x1, y0, y1 } = match.bbox;
  const cx = Math.round((x0 + x1) / 2);
  const cy = Math.round((y0 + y1) / 2);
  return { strategy: 'coordinate', cx, cy };
}
```

### Cross-Platform Selector Abstraction

`tapOn: {testId: "submit-btn"}` should be the preferred form in all new flows.
`testId` maps to:
- **Android:** `resourceId = "${appId}:id/submit-btn"` (requires devs to set `android:id`)
- **iOS:** `accessibilityIdentifier = "submit-btn"` (requires devs to set `.accessibilityIdentifier`)

This is the only selector that is fully cross-platform, stable across app versions, and fast.
Adopt it as the team convention and enforce via lint rule on YAML files.

---

## 10. Reliability: Retries and Smart Waits

### ⚠️ Risk: No Retry = Flaky = Unusable at Scale

Real devices have animation lag, network hiccups, and OS-level dialogs that appear unpredictably.
Without retry, a single 200 ms animation that delays a button's tappability will fail the whole flow.

### Per-Step Retry in `StepExecutor`

```ts
// StepExecutor.ts (sketch)
export async function run(driver, step, header): Promise<StepResult> {
  const maxAttempts = (step.retries ?? header.stepRetries ?? 1) + 1;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const handler = StepHandlerRegistry.resolve(stepName(step));
      await handler({ driver, step, header });
      return { success: true, attempt };
    } catch (e: any) {
      lastError = e;
      if (attempt < maxAttempts) {
        await driver.pause(500 * attempt);   // backoff: 500ms, 1000ms, …
      }
    }
  }

  // Auto-screenshot on final failure
  const shot = await driver.takeScreenshot();
  await saveScreenshot(shot, `FAIL_${stepName(step)}_${Date.now()}`);

  return { success: false, error: lastError!.message, screenshotPath: '…' };
}
```

### Smart Waits Replace Hard Waits

| Instead of | Use |
|-----------|-----|
| `- wait: 2000` after tapping Login | `- waitForNotVisible: "Logging in..."` |
| `- wait: 3000` for page transition | `- waitForVisible: "Dashboard"` |
| `- wait: 1000` before scroll | Remove it — WebdriverIO's built-in implicit wait covers this |

WebdriverIO's `waitUntil` polls at 500 ms intervals up to the configured `timeout`. No sleep required.

### Flow-Level Retry

When the entire flow fails (e.g., device goes offline mid-run), the `retries` header field causes
the spec file to re-acquire a device and replay all steps from scratch:

```ts
// AppiumFlowRunner.spec.ts
jest.retryTimes(header.retries ?? 0, { logErrorsBeforeRetry: true });
```

---

## 11. Observability

### Per-Device, Per-Step Logging

Each Appium server runs with `--log <logRoot>/appium-<udid>.log`:
- Jest: `e2e/logs/appium-<udid>.log`
- API: `logs/appium-<udid>.log`

`StepExecutor` emits structured JSON lines to a run-scoped log file:
- Jest: `e2e/logs/run-<runId>.jsonl`
- API: `artifacts/<runId>/run.jsonl`

```json
{"ts":1746395000000,"udid":"00008110-ABC","flow":"Login Flow","step":3,"action":"tapOn","target":"Password","status":"pass","durationMs":134}
{"ts":1746395001200,"udid":"00008110-ABC","flow":"Login Flow","step":4,"action":"inputText","target":"password123","status":"pass","durationMs":88}
{"ts":1746395002000,"udid":"00008110-ABC","flow":"Login Flow","step":5,"action":"tapOn","target":"Submit","status":"fail","durationMs":10012,"error":"Element not found after 10000ms","screenshot":"FAIL_tapOn_Submit_1746395002.png"}
```

### Video Recording

When `video: true` in the flow header, `SessionManager` starts `mobile: startRecordingScreen` before the first step
and stops/saves it after the last step (or on failure).
- Jest: `e2e/videos/<runId>/screen.mp4`
- API: `artifacts/<runId>/videos/screen.mp4` (served via `/api/flow/artifact/:runId/videos/screen.mp4`)

```ts
// SessionManager.ts
if (header.video) {
  await driver.execute('mobile: startRecordingScreen', { timeLimit: 300 });
}
// … run steps …
const videoBase64 = await driver.execute('mobile: stopRecordingScreen');
// ctx.artifactRoot is injected by FlowRunner: 'e2e/videos/<runId>' or 'artifacts/<runId>/videos'
fs.mkdirSync(ctx.artifactRoot, { recursive: true });
fs.writeFileSync(path.join(ctx.artifactRoot, 'screen.mp4'), Buffer.from(videoBase64, 'base64'));
```

> **iOS note:** `mobile: startRecordingScreen` requires the device to be trusted and Xcode 14+.
> **Android note:** UIAutomator2 supports it natively via `adb screenrecord` fallback if Appium's built-in fails.

### Custom Jest Reporter

A `e2e/reporter/StepReporter.ts` implements Jest's `Reporter` interface to:
- Embed screenshots inline in the HTML report
- Emit a per-step table for each flow (duration, status, selector strategy used, retry count)
- Write `e2e/reports/junit.xml` (for CI) and `e2e/reports/report.html` (for humans)

The API path returns the same `StepResult[]` array in the JSON response body — no separate reporter needed.

---

## 12. CI/CD Integration

### GitHub Actions

```yaml
jobs:
  flow-tests:
    runs-on: macos-latest
    strategy:
      matrix:
        shard: [1, 2, 3]        # one job per device group
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with: { node-version: '20' }

      - name: Install deps
        run: npm ci && npm install -g appium@2 && appium driver install uiautomator2 && appium driver install xcuitest

      - name: Run flows (shard ${{ matrix.shard }})
        run: npx jest --config e2e/jest.config.ts --ci --shard=${{ matrix.shard }}/3
        env:
          APPIUM_PORT_BASE: ${{ 4723 + matrix.shard * 10 }}   # avoid port collisions between jobs

      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-shard-${{ matrix.shard }}
          path: |
            e2e/reports/
            e2e/screenshots/
            e2e/videos/
            e2e/logs/
```

### Bitrise

Use the `Script` step to run `npx jest --config e2e/jest.config.ts --ci` and the
`Deploy to Bitrise.io` step to upload `e2e/reports/junit.xml` as a test result artifact.

### Key CI Rules

- **Never commit `udid` inside `flows/*.yml`**. Device identity belongs in `e2e/device-pool.config.yml` (committed) or supplied via env var / API body at runtime.
- **Always upload artifacts** unconditionally (`if: always()`) — failure artifacts are more valuable than success artifacts.
- **Set `testTimeout: 300_000`** — CI runners are slower than dev machines; 5 min per flow is a safe ceiling.
- **Add `--forceExit`** to Jest args in CI to prevent hung processes when Appium cleanup fails.

---

## 13. Cross-Platform Differences

| Concern | Android (UIAutomator2) | iOS (XCUITest) |
|---------|----------------------|----------------|
| Element ID | `resource-id` (`com.app:id/name`) | `accessibilityIdentifier` |
| Text selector | `UiSelector().text("…")` | `-ios predicate string: label == "…"` |
| Keyboard dismiss | `pressKeyCode(4)` (BACK) or `hideKeyboard()` | `hideKeyboard()` only |
| Clear app state | `mobile: clearApp` (Android 9+) | `terminateApp` + `activateApp` (no real clear) |
| Screen record | `adb shell screenrecord` / Appium built-in | `mobile: startRecordingScreen` (trusted device) |
| Scroll | `mobile: scrollGesture` (UIAutomator2) | `mobile: scroll` (XCUITest) |
| Back navigation | `pressKeyCode(4)` | Must use app's back button or swipe-back gesture |
| App reset | `--full-reset` cap | `--full-reset` cap (slow — requires re-install) |
| Locator speed | UiSelector ≈ 80 ms; XPath ≈ 300 ms | Predicate ≈ 80 ms; XPath ≈ 500 ms |

### Abstraction Boundary

`stepHandlers` must never call platform-specific WebDriver commands directly.
All platform forks live in `SelectorResolver` and in thin helpers inside `SessionManager`:

```ts
// SessionManager.ts
export function platformCommand(driver, name: string, args: object) {
  const prefix = driver.capabilities.platformName === 'iOS' ? 'mobile:' : 'mobile:';
  return driver.execute(`${prefix} ${name}`, args);
}
```

A step handler calls `platformCommand(driver, 'scroll', { direction: 'down' })` and
never needs to know which platform it's running on.

---

## 14. Performance Optimizations

### Reduce Round-Trips

| Problem | Solution |
|---------|---------|
| `findElement` + `click` = 2 RTTs | Use WebdriverIO's `$(sel).click()` — internally 1 RTT on Appium 2 |
| `inputText` char-by-char key events | Use `setValue()` — sends text in one command |
| Polling for element with `wait: N` | Use `driver.waitUntil(() => elem.isDisplayed(), { timeout, interval: 300 })` |
| Fetching page source for assertions | Use `findElement` with a short implicit wait instead of parsing XML source |

### Session Warm-Up

Appium session creation takes 3–8 s per device. Pre-warm sessions in `globalSetup` before Jest starts
distributing test files to workers:

```ts
// globalSetup.ts
await Promise.all(devices.map(d => SessionManager.preWarm(d)));
```

Workers receive a ready session via the shared port map — no cold-start per test file.

### Batching Short Steps

If consecutive steps have no assertion (e.g., `inputText` → `tapOn` → `wait: 200`),
`StepExecutor` can batch them using WebdriverIO's action chains to reduce Appium server round-trips:

```ts
// Future optimisation — v3
await driver.action('pointer')
  .move({ origin: el })
  .down()
  .up()
  .perform();
```

---

## 15. Packages Required (Full List)

### `dependencies`

```bash
npm install webdriverio glob p-limit
# yaml and portfinder already present
```

### `devDependencies`

```bash
npm install -D jest ts-jest @types/jest jest-junit jest-html-reporters
npm install -g appium@2
appium driver install uiautomator2
appium driver install xcuitest
```

### Optional (AI/OCR)

```bash
npm install tesseract.js openai
```
