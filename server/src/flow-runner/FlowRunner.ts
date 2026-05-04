import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppiumServerManager } from './pool/AppiumServerManager';
import { DevicePool } from './pool/DevicePool';
import { SessionManager } from './SessionManager';
import { StepExecutor } from './StepExecutor';
import type { FlowHeader, FlowStep, RunContext, RunResult, RunState } from './types';

// ---------------------------------------------------------------------------
// Async run state store: runId → RunState
// ---------------------------------------------------------------------------

const runs = new Map<string, RunState>();

// ---------------------------------------------------------------------------
// FlowRunner
// ---------------------------------------------------------------------------

export const FlowRunner = {
    /**
     * Run a parsed flow synchronously.
     *
     * Orchestration order:
     *   1. DevicePool.acquire
     *   2. AppiumServerManager.spawn (no-op if already running)
     *   3. SessionManager.create
     *   4. (optional) start screen recording
     *   5. Step loop — breaks on first failure
     *   6. (optional) stop recording → save to ctx.videoRoot/screen.mp4
     *   7. SessionManager.destroy   (always — in finally)
     *   8. DevicePool.release       (always — in finally)
     *
     * Callers supply `RunContext` with canonical artifact paths:
     *   Jest: artifactRoot = e2e/screenshots/<runId>
     *         videoRoot    = e2e/videos/<runId>
     *         logPath      = e2e/logs/run-<runId>.jsonl
     *   API:  artifactRoot = artifacts/<runId>/screenshots
     *         videoRoot    = artifacts/<runId>/videos
     *         logPath      = artifacts/<runId>/run.jsonl
     */
    async run(
        header: FlowHeader,
        steps: FlowStep[],
        ctx: RunContext,
    ): Promise<RunResult> {
        const startMs = Date.now();

        // 1. Acquire device
        const device = await DevicePool.acquire(
            header.platform,
            header.tags ?? [],
            header.udid, // pinnedUdid — undefined when not set at runtime
        );

        let videoUrl: string | undefined;
        let driver: Awaited<ReturnType<typeof SessionManager.create>> | undefined;

        try {
            // 2. Ensure Appium is running; update port on the device record
            const port = await AppiumServerManager.spawn(device.udid);
            DevicePool.setPort(device.udid, port);
            device.appiumPort = port;

            // 3. Create WebdriverIO session
            driver = await SessionManager.create(header, device);

            // 4. Start recording if requested
            if (header.video) {
                await SessionManager.startRecording(driver);
            }

            // 5. Execute steps
            const results = [];
            for (const step of steps) {
                const result = await StepExecutor.run(driver, step, header, ctx);
                results.push(result);
                if (result.status === 'fail') break;
            }

            const success = results.every((r) => r.status === 'pass');

            // 6. Stop recording
            if (header.video && driver) {
                const mp4Path = path.join(ctx.videoRoot, 'screen.mp4');
                const saved = await SessionManager.stopRecording(driver, mp4Path);
                if (saved) videoUrl = saved;
            }

            return {
                success,
                runId: ctx.runId,
                durationMs: Date.now() - startMs,
                results,
                videoUrl,
            };
        } finally {
            // 7. Destroy session
            if (driver) {
                await SessionManager.destroy(driver);
            }
            // 8. Release device
            DevicePool.release(device.udid);
        }
    },

    /**
     * Fire-and-forget variant — starts `run()` in the background.
     * Returns a `runId` that the caller can poll via `getStatus()`.
     */
    startAsync(
        header: FlowHeader,
        steps: FlowStep[],
        ctx: RunContext,
    ): string {
        const runId = ctx.runId || uuidv4();
        const startedAt = Date.now();

        runs.set(runId, { status: 'running', startedAt });

        // Intentional floating promise — caller polls status via getStatus()
        this.run(header, steps, { ...ctx, runId })
            .then((result) => {
                runs.set(runId, {
                    status: 'done',
                    startedAt,
                    finishedAt: Date.now(),
                    result,
                });
            })
            .catch((err: unknown) => {
                runs.set(runId, {
                    status: 'failed',
                    startedAt,
                    finishedAt: Date.now(),
                    error: err instanceof Error ? err.message : String(err),
                });
            });

        return runId;
    },

    /** Return the current state of an async run, or undefined if unknown. */
    getStatus(runId: string): RunState | undefined {
        return runs.get(runId);
    },

    /** Remove a completed run from the state map (call after client retrieves result). */
    clearRun(runId: string): void {
        runs.delete(runId);
    },
};
