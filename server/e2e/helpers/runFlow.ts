/**
 * e2e/helpers/runFlow.ts
 *
 * Self-contained helper that:
 *  1. Reads + parses the YAML file
 *  2. Spawns an Appium server for the given UDID
 *  3. Creates a WebdriverIO session
 *  4. Runs all steps via StepExecutor
 *  5. Tears down session + Appium in a finally block
 *
 * No DevicePool required — caller pins the UDID directly.
 * Designed for manual test cases in e2e/manual.spec.ts and VS Code Test Explorer.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FlowParser } from '../../src/flow-runner/FlowParser';
import { AppiumServerManager } from '../../src/flow-runner/pool/AppiumServerManager';
import { SessionManager } from '../../src/flow-runner/SessionManager';
import { StepExecutor } from '../../src/flow-runner/StepExecutor';
import type { DeviceRecord, RunContext, RunResult } from '../../src/flow-runner/types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RunFlowOptions {
    /** Path to the YAML flow file — relative to the workspace root or absolute. */
    yml: string;
    /**
     * Device UDID.
     * iOS:     xcrun devicectl list devices
     * Android: adb devices
     * Simulator: xcrun simctl list devices
     */
    udid: string;
    /** Additional env vars interpolated into $VAR / ${VAR} step values. */
    env?: Record<string, string>;
}

/**
 * Run a single flow and return its `RunResult`.
 *
 * Throws on flow failure so Jest marks the test as failed and shows the
 * failing step + screenshot path in the Test Explorer output pane.
 */
export async function runFlow(options: RunFlowOptions): Promise<RunResult> {
    const { yml, udid, env } = options;

    // ── 1. Parse YAML ──────────────────────────────────────────────────────
    const ymlPath = path.isAbsolute(yml) ? yml : path.resolve(yml);
    const yamlText = fs.readFileSync(ymlPath, 'utf-8');
    const { header, steps } = FlowParser.parse(yamlText, {
        udid,
        env: { ...process.env as Record<string, string>, ...env },
    });

    // ── 2. Build RunContext ─────────────────────────────────────────────────
    const runId = uuidv4();
    const ctx: RunContext = {
        runId,
        artifactRoot: path.resolve(`e2e/screenshots/${runId}`),
        videoRoot:    path.resolve(`e2e/videos/${runId}`),
        logPath:      path.resolve(`e2e/logs/run-${runId}.jsonl`),
    };

    // ── 3. Spawn Appium (reuses existing process if already running) ────────
    const logDir = path.resolve('e2e/logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, `appium-${udid}.log`);
    const port = await AppiumServerManager.spawn(udid, logPath);

    const device: DeviceRecord = {
        udid,
        platform: header.platform,
        osVersion: 'unknown',
        tags: [],
        appiumPort: port,
    };

    // ── 4. Create session ───────────────────────────────────────────────────
    const driver = await SessionManager.create(header, device);

    const startMs = Date.now();
    const results: RunResult['results'] = [];

    try {
        if (header.video) {
            await SessionManager.startRecording(driver);
        }

        // ── 5. Execute steps ────────────────────────────────────────────────
        for (const step of steps) {
            const result = await StepExecutor.run(driver, step, header, ctx);
            results.push(result);
            if (result.status === 'fail') break;
        }

        const success = results.every((r) => r.status === 'pass');

        let videoUrl: string | undefined;
        if (header.video) {
            const mp4 = path.join(ctx.videoRoot, 'screen.mp4');
            const saved = await SessionManager.stopRecording(driver, mp4);
            if (saved) videoUrl = saved;
        }

        const runResult: RunResult = {
            success,
            runId,
            durationMs: Date.now() - startMs,
            results,
            videoUrl,
        };

        // Throw on failure so Jest shows a proper error in Test Explorer
        if (!success) {
            const failures = results
                .filter((r) => r.status === 'fail')
                .map((r) =>
                    [
                        `  step:       ${r.kind}`,
                        r.error            ? `  error:      ${r.error}` : null,
                        r.screenshotPath   ? `  screenshot: ${r.screenshotPath}` : null,
                    ]
                        .filter(Boolean)
                        .join('\n'),
                )
                .join('\n\n');

            throw new Error(`Flow "${header.name ?? yml}" failed (runId=${runId}):\n\n${failures}`);
        }

        return runResult;
    } finally {
        await SessionManager.destroy(driver);
        await AppiumServerManager.kill(udid);
    }
}
