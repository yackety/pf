import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { StepHandlerRegistry } from '../StepHandlerRegistry';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Device / host handlers
// ---------------------------------------------------------------------------

// ---- wait ------------------------------------------------------------------
// last-resort only — prefer assertion/waitFor steps over explicit sleeps

StepHandlerRegistry.register('wait', async ({ driver, step }) => {
    if (step.kind !== 'wait') return;
    await driver.pause(step.ms);
});

// ---- back ------------------------------------------------------------------

StepHandlerRegistry.register('back', async ({ driver, step, header }) => {
    if (step.kind !== 'back') return;
    if (header.platform === 'android') {
        await driver.execute('mobile: pressKey', { keycode: 4 }); // KEYCODE_BACK
    } else {
        await driver.execute('mobile: pressButton', { name: 'back' });
    }
});

// ---- home ------------------------------------------------------------------

StepHandlerRegistry.register('home', async ({ driver, step, header }) => {
    if (step.kind !== 'home') return;
    if (header.platform === 'android') {
        await driver.execute('mobile: pressKey', { keycode: 3 }); // KEYCODE_HOME
    } else {
        await driver.execute('mobile: pressButton', { name: 'home' });
    }
});

// ---- screenshot ------------------------------------------------------------

StepHandlerRegistry.register('screenshot', async ({ driver, step, artifactRoot }) => {
    if (step.kind !== 'screenshot') return;

    // Ensure directory exists
    fs.mkdirSync(artifactRoot, { recursive: true });

    const filename = `${step.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    const outputPath = path.join(artifactRoot, filename);

    // Take screenshot as base64 via execute (Appium standard)
    const base64 = await driver.execute('mobile: takeScreenshot') as string;
    fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'));
});

// ---- runScript -------------------------------------------------------------

StepHandlerRegistry.register('runScript', async (ctx) => {
    const { step } = ctx;
    if (step.kind !== 'runScript') return;

    // Split on whitespace for a simple command-line parse.
    // Intentional limitation: no shell expansion / glob — pass complex args via a wrapper script.
    const parts = step.script.trim().split(/\s+/);
    const [cmd, ...args] = parts;

    if (!cmd) {
        throw new Error('runScript: script is empty');
    }

    // Callers are responsible for ensuring the command is trusted.
    const { stdout, stderr } = await execFileAsync(cmd, args, {
        timeout: 30_000,
        maxBuffer: 1024 * 1024, // 1 MB
    });

    // Write combined output into ctx.output so StepExecutor can store it in StepResult.output.
    ctx.output = [stdout, stderr].filter(Boolean).join('\n');
});
