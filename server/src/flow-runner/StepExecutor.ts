import fs from 'fs';
import path from 'path';
import { StepHandlerRegistry } from './StepHandlerRegistry';
import type { AppiumDriver, FlowHeader, FlowStep, RunContext, StepResult } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_STEP_RETRIES = 1;
const RETRY_BASE_BACKOFF_MS = 500;

// ---------------------------------------------------------------------------
// StepExecutor
// ---------------------------------------------------------------------------

export const StepExecutor = {
    /**
     * Execute a single step with automatic retry.
     *
     * Retry schedule: up to `header.stepRetries` additional attempts
     * (default 1 total, i.e. no retry), with `500 ms × attempt` backoff.
     *
     * On final failure:
     *  - Screenshot is saved to `ctx.artifactRoot/FAIL_<kind>_<timestamp>.png`
     *  - A JSONL line is appended to `ctx.logPath`
     *
     * Returns a `StepResult` regardless of outcome.
     */
    async run(
        driver: AppiumDriver,
        step: FlowStep,
        header: FlowHeader,
        ctx: RunContext,
    ): Promise<StepResult> {
        const kind = step.kind;
        const maxAttempts = Math.max(1, header.stepRetries ?? DEFAULT_STEP_RETRIES);
        const timeout = header.timeout ?? DEFAULT_TIMEOUT_MS;

        let lastError: Error | undefined;
        let screenshotPath: string | undefined;
        let selectorStrategy: string | undefined;
        let output: string | undefined;

        const startMs = Date.now();

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (attempt > 1) {
                await pause(RETRY_BASE_BACKOFF_MS * attempt);
            }

            const ctx2 = {
                driver,
                step,
                header,
                artifactRoot: ctx.artifactRoot,
                timeout,
                output: undefined as string | undefined,
                selectorStrategy: undefined as string | undefined,
            };

            try {
                const handler = StepHandlerRegistry.resolve(kind);
                await handler(ctx2);

                selectorStrategy = ctx2.selectorStrategy;
                output = ctx2.output;

                const durationMs = Date.now() - startMs;
                const result: StepResult = {
                    kind,
                    status: 'pass',
                    durationMs,
                    attempt,
                    selectorStrategy,
                    output,
                };
                appendLog(ctx.logPath, header, result);
                return result;
            } catch (e: unknown) {
                lastError = e instanceof Error ? e : new Error(String(e));
                selectorStrategy = ctx2.selectorStrategy;
                output = ctx2.output;
            }
        }

        // All attempts exhausted — capture failure screenshot
        screenshotPath = await captureFailureScreenshot(driver, kind, ctx.artifactRoot);

        const durationMs = Date.now() - startMs;
        const result: StepResult = {
            kind,
            status: 'fail',
            durationMs,
            attempt: maxAttempts,
            screenshotPath,
            error: lastError?.message,
            selectorStrategy,
            output,
        };
        appendLog(ctx.logPath, header, result);
        return result;
    },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureFailureScreenshot(
    driver: AppiumDriver,
    kind: string,
    artifactRoot: string,
): Promise<string | undefined> {
    try {
        fs.mkdirSync(artifactRoot, { recursive: true });
        const ts = Date.now();
        const filename = `FAIL_${kind}_${ts}.png`;
        const filePath = path.join(artifactRoot, filename);
        const base64 = await driver.execute('mobile: takeScreenshot', {}) as string;
        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
        return filePath;
    } catch {
        return undefined;
    }
}

function appendLog(logPath: string, header: FlowHeader, result: StepResult): void {
    try {
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        const line = JSON.stringify({
            ts: new Date().toISOString(),
            udid: header.udid ?? null,
            flow: header.name ?? null,
            kind: result.kind,
            status: result.status,
            durationMs: result.durationMs,
            attempt: result.attempt,
            selectorStrategy: result.selectorStrategy ?? null,
            error: result.error ?? null,
        });
        fs.appendFileSync(logPath, line + '\n', 'utf-8');
    } catch {
        // Log errors are non-fatal — never mask test failures.
    }
}
