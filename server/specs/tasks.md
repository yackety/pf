# Implementation Tasks — Local Runner Only

Scope: everything needed to run flows locally via Jest (`npx jest`) and via the HTTP API (`curl`).
Out of scope: CI/CD, deployment, cloud device farms, remote Appium grids.

Progress legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 1 — Foundation (types + parser)

No Appium required. Pure TypeScript. Can be built and unit-tested offline.

- [x] **1.1** Create `src/flow-runner/types.ts`
  - Interfaces: `FlowHeader`, `FlowStep` (union of all step shapes), `StepResult`, `DeviceRecord`, `RunResult`, `RunContext`
  - `FlowStep` must be a discriminated union so handlers are type-safe
  - `RunContext` carries per-run configuration injected by `FlowRunner`:
    ```ts
    interface RunContext {
      runId: string;
      artifactRoot: string;  // absolute path; consumers set this:
                             //   Jest:  path.resolve('e2e/screenshots/<runId>')
                             //   API:   path.resolve('artifacts/<runId>/screenshots')
      logPath: string;       // absolute path to JSONL log file
                             //   Jest:  'e2e/logs/run-<runId>.jsonl'
                             //   API:   'artifacts/<runId>/run.jsonl'
    }
    ```
  - Example shapes:
    ```ts
    type FlowStep =
      | { kind: 'launchApp' }
      | { kind: 'tapOn';        target: string | { id?: string; testId?: string; xpath?: string } }
      | { kind: 'inputText';    text: string }
      | { kind: 'assertVisible'; target: string }
      | { kind: 'wait';         ms: number }
      // … all others from SPEC §3
    ```

- [x] **1.2** Create `src/flow-runner/EnvInterpolator.ts`
  - `interpolate(value: string, env: Record<string, string>): string`
  - Replaces `$VAR` and `${VAR}` using `header.env` merged over `process.env`
  - Does NOT throw on missing vars — leaves them as-is and emits a warning

- [x] **1.3** Create `src/flow-runner/FlowParser.ts`
  - `FlowParser.parse(yamlString: string, overrides?: { udid?: string; env?: Record<string,string> }): { header: FlowHeader; steps: FlowStep[] }`
  - Split on first `\n---\n` (document separator)
  - Parse header block with the `yaml` package (already in `package.json`)
  - Parse steps block — each item is either a plain string (`"launchApp"`) or a single-key object (`{ tapOn: "Submit" }`)
  - Normalise both forms into typed `FlowStep` objects
  - Apply `EnvInterpolator` to all string values in steps
  - Throw descriptive errors for unknown step types or missing required fields

- [x] **1.4** Write unit tests for `FlowParser` and `EnvInterpolator`
  - File: `src/flow-runner/__tests__/FlowParser.test.ts`
  - Test: valid YAML parses correctly, `$VAR` substitution, missing `appId` throws, unknown step type throws
  - Run with existing Jest setup (no device needed)

---

## Phase 2 — Step Handler Registry

Still no Appium. Registry is just a `Map`. Handlers are registered but not yet called with a real driver.

- [x] **2.1** Create `src/flow-runner/StepHandlerRegistry.ts`
  - `register(kind: string, fn: StepHandler): void`
  - `resolve(kind: string): StepHandler` — throws `Unknown step type` if not found
  - `StepHandler` type: `(ctx: StepContext) => Promise<void>`
  - `StepContext`: `{ driver: WebdriverIO.Browser; step: FlowStep; header: FlowHeader }`

- [x] **2.2** Create `src/flow-runner/handlers/lifecycle.ts`
  - Registers: `launchApp`, `restartApp`, `stopApp`, `clearApp`
  - `launchApp` → `driver.activateApp(header.appId)`
  - `restartApp` → `driver.terminateApp(header.appId)` + `driver.activateApp(header.appId)`
  - `clearApp` → Android: `driver.execute('mobile: clearApp', { appId })` / iOS: terminate + relaunch (best effort)

- [x] **2.3** Create `src/flow-runner/handlers/interaction.ts`
  - Registers: `tapOn`, `longPressOn`, `doubleTapOn`, `inputText`, `clearText`, `hideKeyboard`, `scroll`, `scrollTo`, `swipe`
  - `tapOn` delegates to `SelectorResolver` (stub in Phase 3, replace in Phase 4)
  - `inputText` → find active element → `setValue(text)` (single round-trip, not key-by-key)
  - `scroll` → use `driver.execute('mobile: scrollGesture', …)` (Android) / `driver.execute('mobile: scroll', …)` (iOS)

- [x] **2.4** Create `src/flow-runner/handlers/assertions.ts`
  - Registers: `assertVisible`, `assertNotVisible`, `assertChecked`, `assertEqual`, `waitForVisible`, `waitForNotVisible`
  - `assertVisible` → `driver.waitUntil(() => el.isDisplayed(), { timeout, interval: 300 })` — NO hard sleep
  - `assertNotVisible` → confirm element does not exist OR `isDisplayed() === false`
  - `waitForVisible` / `waitForNotVisible` → same as assert variants but do not fail (used as sync points)

- [x] **2.5** Create `src/flow-runner/handlers/device.ts`
  - Registers: `wait`, `back`, `home`, `screenshot`, `runScript`
  - `wait` → `driver.pause(ms)` — document it as last-resort only
  - `back` → Android: `driver.pressKeyCode(4)` / iOS: `driver.back()`
  - `screenshot` → `driver.takeScreenshot()` → save to `ctx.artifactRoot/<name>.png` (create dir if missing)
  - `runScript` → `child_process.execFile` on the host — capture stdout/stderr into `StepResult.output`

---

## Phase 3 — Selector Resolver (basic, no OCR)

- [x] **3.1** Create `src/flow-runner/SelectorResolver.ts`
  - `resolve(driver, target, platform, appId, timeout): Promise<WebdriverIO.Element>`
  - Implement strategies 1–6 from SPEC §9 in priority order (stop at first hit):
    1. `testId` → Android `id: "${appId}:id/${testId}"` / iOS `~${testId}`
    2. `id` → Android `id: "${appId}:id/${id}"` / iOS `~${id}`
    3. Accessibility label → `~${text}`
    4. Android UiSelector → `-android uiautomator: new UiSelector().text("${text}")`
    5. iOS predicate → `-ios predicate string: label == "${text}" OR value == "${text}"`
    6. XPath fallback → `//*[@text='${text}' or @content-desc='${text}' or @label='${text}']`
  - Each strategy is tried in a `try/catch` — only throws if ALL strategies fail
  - Expose `lastStrategy` on result so `StepExecutor` can log it

- [x] **3.2** Create `src/flow-runner/SelfHealingCache.ts`
  - `load(): Cache` — reads `.cache/selectors.json` (creates empty file if missing)
  - `save(cache: Cache): void` — writes atomically (write to `.tmp` then rename)
  - `get(appId, appVersion, label): CachedSelector | undefined`
  - `set(appId, appVersion, label, selector: CachedSelector): void`
  - Hook into `SelectorResolver`: check cache before strategy 1, update cache after success

- [x] **3.3** Update `SelectorResolver` to use `SelfHealingCache`
  - On cache hit: try the cached selector first — if it works, return immediately (skips all other strategies)
  - On cache miss or stale hit: run strategies 1–6, then write winner to cache
  - On total failure: emit `SELECTOR_FAILED` event (OCR fallback is Phase 6, optional)

---

## Phase 4 — Device Pool & Appium Server Manager

- [x] **4.1** Create `e2e/device-pool.config.yml`
  - UDIDs live **here and only here** — never in `flows/*.yml`
  - Start with a single real device or simulator for local dev:
    ```yaml
    devices:
      - udid: <your-device-udid>   # get via: xcrun devicectl list devices (iOS) / adb devices (Android)
        platform: ios              # or android
        osVersion: "17.4"
        tags: [local]
    ```
  - In CI, override UDIDs via env vars (`DEVICE_UDID`) — do not commit real CI device UDIDs to this file.

- [x] **4.2** Create `src/flow-runner/pool/DeviceRecord.ts`
  - Interface: `{ udid, platform, osVersion, tags, appiumPort: number | null }`

- [x] **4.3** Create `src/flow-runner/pool/AppiumServerManager.ts`
  - `spawn(udid: string): Promise<number>` — start `appium --port <auto> --log <logPath> --log-level warn`
    - Jest log path: `e2e/logs/appium-<udid>.log`
    - API log path: `logs/appium-<udid>.log`
    - Create the target log directory automatically if missing
  - Use `portfinder` (already in `package.json`) for port assignment
  - Poll `GET http://127.0.0.1:<port>/status` until HTTP 200 or timeout (20 s)
  - `kill(udid: string): Promise<void>` — SIGTERM the child process
  - Store `{ udid → { port, proc } }` in a module-level Map

- [x] **4.4** Create `src/flow-runner/pool/DevicePool.ts`
  - `init(configPath: string): void` — loads `device-pool.config.yml`, reads devices into pool
  - `acquire(platform: string, tags: string[], pinnedUdid?: string): Promise<DeviceRecord>`
    - If `pinnedUdid` is set, wait for that specific device
    - Otherwise pick first free device matching platform + all tags
    - Spin-wait with 500 ms interval, max 60 s, then throw `DevicePoolTimeout`
  - `release(udid: string): void`
  - Use `p-limit` or a simple `Map<udid, Promise>` mutex — avoid external lock files

---

## Phase 5 — Session Manager & Step Executor

- [x] **5.1** Create `src/flow-runner/SessionManager.ts`
  - `create(header: FlowHeader, device: DeviceRecord): Promise<WebdriverIO.Browser>`
  - Build WebdriverIO capabilities object based on `platform`:
    ```ts
    // Android
    { platformName: 'Android', 'appium:udid': device.udid,
      'appium:automationName': 'UiAutomator2', 'appium:noReset': !header.resetApp }
    // iOS
    { platformName: 'iOS', 'appium:udid': device.udid,
      'appium:automationName': 'XCUITest', 'appium:noReset': !header.resetApp,
      'appium:wdaLaunchTimeout': 60000 }
    ```
  - Connect to `http://127.0.0.1:<device.appiumPort>/`
  - Set implicit wait to `0` — all waits are explicit via `waitUntil`
  - `destroy(driver): Promise<void>` — `driver.deleteSession()` with a 5 s timeout

- [x] **5.2** Create `src/flow-runner/StepExecutor.ts`
  - `run(driver, step, header, ctx: RunContext): Promise<StepResult>`
  - Resolve handler from `StepHandlerRegistry`
  - Retry loop: `stepRetries` attempts with `500ms * attempt` backoff
  - On final failure: take screenshot → save to `ctx.artifactRoot/FAIL_<kind>_<ts>.png`
  - Return `StepResult`: `{ step, kind, status, durationMs, attempt, screenshotPath?, error?, selectorStrategy? }`
  - Emit a structured log line to `ctx.logPath` (JSONL) after each step

- [x] **5.3** Create `src/flow-runner/FlowRunner.ts`
  - `run(header, steps, ctx: RunContext): Promise<RunResult>` — used by both Jest and API
    1. `DevicePool.acquire(…)`
    2. Spawn Appium if not already running (`AppiumServerManager.spawn`)
    3. `SessionManager.create(…)`
    4. `if (header.video) start screen recording`
    5. Loop: `StepExecutor.run(…, ctx)` — break on first failure
    6. `if (header.video) stop + save recording to ctx.videoRoot/screen.mp4`
    7. `SessionManager.destroy(…)` in `finally`
    8. `DevicePool.release(…)` in `finally`
  - `startAsync(header, steps, ctx): string` — fires `run()` in background, stores result in a `Map<runId, RunState>`
  - `getStatus(runId): RunState | undefined`
  - **Callers are responsible for constructing `RunContext`** — see §4 Artifact Directories for canonical paths.

---

## Phase 6 — Jest e2e Wrapper

- [ ] **6.1** Add dev dependencies to `package.json`
  ```bash
  npm install -D jest ts-jest @types/jest jest-junit jest-html-reporters
  npm install webdriverio glob p-limit
  ```

- [ ] **6.2** Create `e2e/tsconfig.json`
  ```json
  {
    "extends": "../tsconfig.json",
    "compilerOptions": { "types": ["node", "jest"] },
    "include": ["**/*", "../src/flow-runner/**/*"]
  }
  ```

- [ ] **6.3** Create `e2e/jest.config.ts`
  ```ts
  export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    testMatch: ['**/*.spec.ts'],
    globalSetup:    './setup/globalSetup.ts',
    globalTeardown: './setup/globalTeardown.ts',
    maxWorkers: process.env.DEVICE_COUNT ?? 1,
    testTimeout: 300_000,
    reporters: ['default', 'jest-junit', 'jest-html-reporters'],
    forceExit: true,
  };
  ```

- [ ] **6.4** Create `e2e/setup/globalSetup.ts`
  - `DevicePool.init('e2e/device-pool.config.yml')`
  - For each device in pool: `AppiumServerManager.spawn(udid)` (in parallel), logs to `e2e/logs/appium-<udid>.log`
  - Write port map to `/tmp/appium-ports-<runId>.json` for workers to read
  - Verify all Appium servers are healthy before returning

- [ ] **6.5** Create `e2e/setup/globalTeardown.ts`
  - For each spawned Appium process: `AppiumServerManager.kill(udid)`
  - Delete the temp port map file

- [ ] **6.6** Create `e2e/AppiumFlowRunner.spec.ts`
  - Glob `flows/**/*.yml`
  - For each file: `FlowParser.parse(...)` → `describe` block → `DevicePool.acquire` in `beforeAll`
  - Build `RunContext` for each run:
    ```ts
    const ctx: RunContext = {
      runId,
      artifactRoot: path.resolve(`e2e/screenshots/${runId}`),
      logPath:      path.resolve(`e2e/logs/run-${runId}.jsonl`),
    };
    ```
  - Single `it('full flow', …)` per describe — use `FlowRunner.run(header, steps, ctx)` directly
  - On failure: attach screenshot path to Jest's `expect` failure message
  - `jest.retryTimes(header.retries ?? 0)`

- [ ] **6.7** Smoke test — run `flows/login.yml` against a real device
  ```bash
  # Supply udid via env var — never add it to the YAML file
  DEVICE_UDID=<your-udid> npx jest --config e2e/jest.config.ts --runInBand
  ```

---

## Phase 7 — HTTP API Routes

- [ ] **7.1** Wire `POST /api/flow/run-file` in `src/server/services/HttpServer.ts`
  - Validate `path` param — must resolve inside `flows/` (path traversal guard, mandatory)
  - Read YAML, call `FlowParser.parse(yaml, { udid, env })` — `udid` comes from request body, never from the YAML file
  - Build `RunContext`:
    ```ts
    const ctx: RunContext = {
      runId,
      artifactRoot: path.resolve(`artifacts/${runId}/screenshots`),
      logPath:      path.resolve(`artifacts/${runId}/run.jsonl`),
    };
    ```
  - Sync: call `FlowRunner.run(header, steps, ctx)` → return `RunResult` as JSON
  - Async (`body.async === true`): call `FlowRunner.startAsync(header, steps, ctx)` → return `{ runId, statusUrl }`

- [ ] **7.2** Wire `POST /api/flow/run` (inline YAML)
  - Body: `{ yaml: string, udid?: string, env?: object, async?: boolean }` — `udid` is an input param, not embedded in YAML
  - Same flow as 7.1 but YAML comes from request body instead of file

- [ ] **7.3** Wire `GET /api/flow/status/:runId`
  - Returns `{ runId, status: 'running' | 'done' | 'failed', startedAt, finishedAt? }`
  - 404 if `runId` unknown

- [ ] **7.4** Wire `GET /api/flow/result/:runId`
  - Returns full `RunResult` with all step results
  - 404 if unknown, 425 if still running

- [ ] **7.5** Wire `GET /api/flow/artifact/:runId/:filepath`
  - Serves any file from `artifacts/<runId>/<filepath>`
  - Validate `filepath` to prevent path traversal: resolve must stay inside `artifacts/<runId>/`
  - Covers screenshots, videos, and the JSONL log

- [ ] **7.6** Add Swagger docs for all `/api/flow/*` routes in `src/server/services/swagger.ts`

- [ ] **7.7** Smoke test via curl
  ```bash
  # Device from pool (preferred)
  curl -X POST http://localhost:11000/api/flow/run-file \
    -H 'Content-Type: application/json' \
    -d '{"path":"flows/login.yml"}'

  # Pin to a specific device (dev/debug only — udid in request body, not in YAML)
  curl -X POST http://localhost:11000/api/flow/run-file \
    -H 'Content-Type: application/json' \
    -d '{"path":"flows/login.yml","udid":"<your-udid>"}'
  ```

---

## Phase 8 — Observability (local)

- [ ] **8.1** Structured step logging
  - `StepExecutor` writes one JSONL line per step to `ctx.logPath` (passed through `RunContext`)
  - Canonical log paths:
    - Jest: `e2e/logs/run-<runId>.jsonl`
    - API:  `artifacts/<runId>/run.jsonl`
  - Fields: `ts`, `udid`, `flow`, `step`, `kind`, `target`, `status`, `durationMs`, `attempt`, `selectorStrategy`
  - Create the log directory automatically if missing; add to `.gitignore`

- [ ] **8.2** Screenshot on failure
  - Already covered in `StepExecutor` (Phase 5.2) — confirm screenshots save to `ctx.artifactRoot/FAIL_<kind>_<ts>.png`
  - For API runs: `screenshotUrl` in the response points at `/api/flow/artifact/<runId>/screenshots/FAIL_<kind>_<ts>.png`

- [ ] **8.3** Video recording (optional, enable per-flow with `video: true`)
  - `SessionManager.startRecording(driver)` → `mobile: startRecordingScreen`
  - `SessionManager.stopRecording(driver, outputPath)` → `mobile: stopRecordingScreen` → decode base64 → write `.mp4`
  - Canonical video paths (derived from `RunContext.artifactRoot`):
    - Jest: `e2e/videos/<runId>/screen.mp4`
    - API:  `artifacts/<runId>/videos/screen.mp4`
  - iOS: needs trusted device + Xcode 14+; Android: built into UIAutomator2
  - Add `videoUrl` to `RunResult`

- [ ] **8.4** Add `e2e/reporter/StepReporter.ts` (Jest only)
  - Implement Jest `Reporter` interface
  - Print a per-step duration table to stdout after each suite
  - Append screenshot paths to failing test messages

---

## Phase 9 — Developer Experience

- [ ] **9.1** Add npm scripts to `package.json`
  ```json
  "scripts": {
    "flow:test":  "jest --config e2e/jest.config.ts",
    "flow:run":   "ts-node -e \"require('./src/flow-runner/FlowRunner').FlowRunner.run(...)\"",
    "flow:watch": "jest --config e2e/jest.config.ts --watch --runInBand"
  }
  ```

- [ ] **9.2** Create `flows/login.yml` with real device values
  - Replace placeholder `udid` with an actual device UDID
  - Replace placeholder `appId` with a real installed app

- [ ] **9.3** Add `.gitignore` entries
  ```
  # Jest outputs
  e2e/screenshots/
  e2e/videos/
  e2e/reports/
  e2e/logs/

  # API outputs
  artifacts/
  logs/

  # Do NOT ignore:
  # .cache/selectors.json        ← self-healing cache: commit it
  # e2e/device-pool.config.yml   ← commit structure; CI overrides UDIDs via env vars
  # flows/                       ← committed YAML (no udid fields inside)
  ```

- [ ] **9.4** README section — "Running flows locally"
  - Prerequisites checklist (Appium, drivers, `adb`/`xcrun`, env vars)
  - Quick start: one command to run all flows, one to run a single flow
  - How to add a new flow YAML

---

## Dependency Map

```
Phase 1 (types, parser)
    └── Phase 2 (handlers)      ← needs types
         └── Phase 3 (selectors) ← needs handlers + driver interface
              └── Phase 4 (pool) ← needs device model
                   └── Phase 5 (runner core) ← needs pool + session + executor
                        ├── Phase 6 (Jest)  ← needs FlowRunner
                        └── Phase 7 (API)   ← needs FlowRunner
                             └── Phase 8 (observability) ← needs executor + API
                                  └── Phase 9 (DX) ← needs everything
```

Phases 1–3 have no device requirement — they can be built and unit-tested with a laptop and no phone connected.
Phase 4 onwards requires at least one real device or simulator.
