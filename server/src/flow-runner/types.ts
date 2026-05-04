// ---------------------------------------------------------------------------
// Flow header — the section before `\n---\n` in a .yml flow file
// ---------------------------------------------------------------------------

export interface FlowHeader {
    /** Bundle ID (Android) or CFBundleIdentifier (iOS). Required. */
    appId: string;
    /** Target platform. Required. */
    platform: 'android' | 'ios';
    /** Human-readable name. Defaults to the filename. */
    name?: string;
    /**
     * Device UDID. NEVER put this in a committed flow file.
     * Injected at runtime via: env var DEVICE_UDID, API request body, or DevicePool allocation.
     */
    udid?: string;
    /** Device pool selector tags, e.g. ['ios17', 'iphone15']. */
    tags?: string[];
    /** Per-step element-wait timeout in ms. Default: 10 000. */
    timeout?: number;
    /** Terminate + clear app state before running. Default: false. */
    resetApp?: boolean;
    /** Flow-level retry count on total failure. Default: 0. */
    retries?: number;
    /** Per-step retry count. Default: 1. */
    stepRetries?: number;
    /** Record screen for the full run. Default: false. */
    video?: boolean;
    /** Variables interpolated into step string values. */
    env?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Tap target — used by tapOn, longPressOn, doubleTapOn
// ---------------------------------------------------------------------------

export interface TapTarget {
    /** data-testid / accessibilityIdentifier — preferred. */
    testId?: string;
    /** resource-id (Android) or element name (iOS). */
    id?: string;
    /** Raw XPath — last resort. */
    xpath?: string;
}

// ---------------------------------------------------------------------------
// Flow steps — discriminated union; one member per step kind
// ---------------------------------------------------------------------------

export type FlowStep =
    // App lifecycle
    | { kind: 'launchApp' }
    | { kind: 'restartApp' }
    | { kind: 'clearApp' }
    | { kind: 'stopApp' }
    // Element interaction
    | { kind: 'tapOn';       target: string | TapTarget }
    | { kind: 'longPressOn'; target: string }
    | { kind: 'doubleTapOn'; target: string }
    | { kind: 'inputText';   text: string }
    | { kind: 'clearText' }
    | { kind: 'hideKeyboard' }
    // Scrolling / swiping
    | { kind: 'scroll';   direction: 'up' | 'down' | 'left' | 'right' }
    | { kind: 'scrollTo'; target: string }
    | { kind: 'swipe';    from: [number, number]; to: [number, number] }
    // Assertions
    | { kind: 'assertVisible';    target: string }
    | { kind: 'assertNotVisible'; target: string }
    | { kind: 'assertChecked';    target: string }
    | { kind: 'assertEqual';      id: string; value: string }
    // Waiting
    | { kind: 'waitForVisible';    target: string }
    | { kind: 'waitForNotVisible'; target: string }
    | { kind: 'wait'; ms: number }
    // Device / host
    | { kind: 'back' }
    | { kind: 'home' }
    | { kind: 'screenshot'; name: string }
    | { kind: 'runScript';  script: string };

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface StepResult {
    kind: string;
    status: 'pass' | 'fail' | 'skip';
    durationMs: number;
    attempt: number;
    screenshotPath?: string;
    error?: string;
    /** Winning selector strategy used (e.g. 'testId', 'uiautomator', 'xpath'). */
    selectorStrategy?: string;
    /** stdout + stderr from a runScript step. */
    output?: string;
}

export interface RunResult {
    success: boolean;
    runId: string;
    durationMs: number;
    results: StepResult[];
    videoUrl?: string;
}

// ---------------------------------------------------------------------------
// Device pool
// ---------------------------------------------------------------------------

export interface DeviceRecord {
    udid: string;
    platform: 'android' | 'ios';
    osVersion: string;
    tags: string[];
    /** Set by AppiumServerManager.spawn(); null until the server is started. */
    appiumPort: number | null;
}

// ---------------------------------------------------------------------------
// Run context — injected by the caller (Jest or API), never hardcoded inside
// the shared flow-runner library.
//
// Canonical paths:
//   Jest  → artifactRoot: path.resolve(`e2e/screenshots/${runId}`)
//           videoRoot:    path.resolve(`e2e/videos/${runId}`)
//           logPath:      path.resolve(`e2e/logs/run-${runId}.jsonl`)
//
//   API   → artifactRoot: path.resolve(`artifacts/${runId}/screenshots`)
//           videoRoot:    path.resolve(`artifacts/${runId}/videos`)
//           logPath:      path.resolve(`artifacts/${runId}/run.jsonl`)
// ---------------------------------------------------------------------------

export interface RunContext {
    runId: string;
    /** Absolute path — screenshots are saved here. Created automatically if absent. */
    artifactRoot: string;
    /** Absolute path — video is saved as `<videoRoot>/screen.mp4`. Created automatically if absent. */
    videoRoot: string;
    /** Absolute path to the per-run JSONL step log. */
    logPath: string;
}

// ---------------------------------------------------------------------------
// Async run state (used by FlowRunner.startAsync)
// ---------------------------------------------------------------------------

export type RunState =
    | { status: 'running';  startedAt: number }
    | { status: 'done';     startedAt: number; finishedAt: number; result: RunResult }
    | { status: 'failed';   startedAt: number; finishedAt: number; error: string };
