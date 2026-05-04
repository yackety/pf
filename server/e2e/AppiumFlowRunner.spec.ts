/**
 * e2e/AppiumFlowRunner.spec.ts
 *
 * Discovers every *.yml file under e2e/flows/, parses each one, and runs
 * it as a Jest describe/it block via FlowRunner.run().
 *
 * Usage:
 *   # Supply the device UDID at runtime — never commit it into a flow YAML
 *   DEVICE_UDID=<udid> npx jest --config e2e/jest.config.ts --runInBand
 *
 *   # Run a single flow
 *   DEVICE_UDID=<udid> npx jest --config e2e/jest.config.ts -t "login"
 */

import fs from 'fs';
import { glob } from 'glob';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FlowParser } from '../src/flow-runner/FlowParser';
import { FlowRunner } from '../src/flow-runner/FlowRunner';
import type { RunContext } from '../src/flow-runner/types';

// ---------------------------------------------------------------------------
// Discover flow files
// ---------------------------------------------------------------------------

const FLOWS_DIR = path.resolve(__dirname, 'flows');

// glob returns unix-style paths even on Windows; resolve normalises them
let flowFiles: string[] = [];

if (fs.existsSync(FLOWS_DIR)) {
    flowFiles = glob.sync('**/*.yml', { cwd: FLOWS_DIR, absolute: true });
}

// ---------------------------------------------------------------------------
// Build one describe block per flow file
// ---------------------------------------------------------------------------

if (flowFiles.length === 0) {
    describe('AppiumFlowRunner', () => {
        it('no flow files found', () => {
            console.warn(`No *.yml files found in ${FLOWS_DIR}. Add flows to run e2e tests.`);
        });
    });
} else {
    for (const filePath of flowFiles) {
        const yaml = fs.readFileSync(filePath, 'utf-8');

        // Parse header to get the flow name and retries; udid comes from env
        let parsed: ReturnType<typeof FlowParser.parse>;
        try {
            parsed = FlowParser.parse(yaml, {
                udid: process.env.DEVICE_UDID,
                env: process.env as Record<string, string>,
            });
        } catch (err) {
            // Register a failing test so the error is visible in the Jest report
            const rel = path.relative(FLOWS_DIR, filePath);
            describe(`[parse error] ${rel}`, () => {
                it('parses successfully', () => {
                    throw err;
                });
            });
            continue;
        }

        const { header, steps } = parsed;
        const flowName = header.name ?? path.relative(FLOWS_DIR, filePath);
        const retries = header.retries ?? 0;

        describe(flowName, () => {
            // Configure Jest retry count for the whole describe block
            jest.retryTimes(retries);

            it('full flow', async () => {
                const runId = uuidv4();

                const ctx: RunContext = {
                    runId,
                    artifactRoot: path.resolve(__dirname, 'screenshots', runId),
                    videoRoot:    path.resolve(__dirname, 'videos',      runId),
                    logPath:      path.resolve(__dirname, 'logs',        `run-${runId}.jsonl`),
                };

                const result = await FlowRunner.run(header, steps, ctx);

                if (!result.success) {
                    // Collect failure details from step results for the Jest error message
                    const failures = result.results
                        .filter((r) => r.status === 'fail')
                        .map((r) => {
                            const parts = [
                                `  step: ${r.kind}`,
                                r.error ? `  error: ${r.error}` : null,
                                r.screenshotPath ? `  screenshot: ${r.screenshotPath}` : null,
                            ];
                            return parts.filter(Boolean).join('\n');
                        })
                        .join('\n\n');

                    throw new Error(
                        `Flow "${flowName}" failed (runId=${runId}):\n\n${failures}`,
                    );
                }

                expect(result.success).toBe(true);
            });
        });
    }
}
