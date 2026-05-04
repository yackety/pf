/**
 * e2e/reporter/StepReporter.ts
 *
 * A custom Jest reporter that:
 *  1. Prints a per-step duration table to stdout after each test suite.
 *  2. Appends screenshot paths extracted from failure messages to the output.
 *
 * Registered in e2e/jest.config.ts under `reporters`.
 *
 * NOTE: Jest reporters receive the top-level `AssertionResult` objects which
 * contain the test title, duration, status, and failure messages.  Because
 * our spec generates one `it('full flow', …)` per flow file, the "duration
 * table" here is one row per describe/it pair — useful for spotting slow
 * flows at a glance without opening the HTML report.
 */

import type { AggregatedResult, Reporter, Test, TestResult } from '@jest/reporters';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const DIM  = '\x1b[2m';
const RST  = '\x1b[0m';

function formatMs(ms: number | undefined | null): string {
    if (ms == null) return '—';
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
    return `${Math.round(ms)} ms`;
}

/** Pull screenshot paths out of a Jest failure message string. */
function extractScreenshots(messages: string[]): string[] {
    const paths: string[] = [];
    for (const msg of messages) {
        // Match absolute paths ending in .png (written by StepExecutor)
        const matches = msg.match(/[^\s'"]+FAIL_[^\s'"]+\.png/g);
        if (matches) paths.push(...matches);
    }
    return paths;
}

// ---------------------------------------------------------------------------
// Reporter implementation
// ---------------------------------------------------------------------------

export default class StepReporter implements Reporter {
    /**
     * Called once per test *file* after all tests in that file have run.
     * We print the per-test duration table here.
     */
    onTestResult(_test: Test, testResult: TestResult, _aggregated: AggregatedResult): void {
        const { testFilePath, testResults } = testResult;

        if (testResults.length === 0) return;

        const rel = testFilePath.replace(process.cwd() + '/', '');
        console.log(`\n${DIM}── ${rel} ──────────────────────────────────────${RST}`);

        // Column widths
        const nameWidth = Math.max(
            20,
            ...testResults.map((r) => r.fullName.length),
        );

        // Header row
        console.log(
            `  ${'Test'.padEnd(nameWidth)}  ${'Duration'.padStart(10)}  Status`,
        );
        console.log(`  ${'-'.repeat(nameWidth)}  ${'-'.repeat(10)}  ------`);

        for (const r of testResults) {
            const icon   = r.status === 'passed' ? PASS : FAIL;
            const name   = r.fullName.padEnd(nameWidth);
            const dur    = formatMs(r.duration).padStart(10);
            console.log(`  ${name}  ${dur}  ${icon}`);

            // If failed, show screenshot paths (if any) under the row
            if (r.status === 'failed') {
                const screenshots = extractScreenshots(r.failureMessages);
                for (const p of screenshots) {
                    console.log(`    ${DIM}📷  ${p}${RST}`);
                }
                // Also print the first line of each failure message for quick context
                for (const msg of r.failureMessages) {
                    const firstLine = msg.split('\n').find((l) => l.trim()) ?? msg;
                    console.log(`    ${DIM}⚠  ${firstLine.trim()}${RST}`);
                }
            }
        }
    }

    /**
     * Called once after the entire test run completes.
     * Prints a summary line: total flows, passed, failed, total time.
     */
    onRunComplete(_contexts: Set<unknown>, results: AggregatedResult): void {
        const { numPassedTests, numFailedTests, numTotalTests } = results;
        const totalMs = results.startTime ? Date.now() - results.startTime : undefined;

        console.log('\n');
        console.log('┌────────────────────────────────────────────────┐');
        console.log('│              Appium Flow Results                │');
        console.log('├────────────────────────────────────────────────┤');
        console.log(`│  Total  : ${String(numTotalTests).padStart(4)} flows` + ' '.repeat(35 - String(numTotalTests).length) + '│');
        console.log(`│  Passed : ${String(numPassedTests).padStart(4)} flows` + ' '.repeat(35 - String(numPassedTests).length) + '│');
        console.log(`│  Failed : ${String(numFailedTests).padStart(4)} flows` + ' '.repeat(35 - String(numFailedTests).length) + '│');
        if (totalMs != null) {
            const durStr = formatMs(totalMs);
            console.log(`│  Time   : ${durStr.padStart(4)}` + ' '.repeat(40 - durStr.length) + '│');
        }
        console.log('└────────────────────────────────────────────────┘');
    }
}
