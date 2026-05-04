import { StepHandlerRegistry } from '../StepHandlerRegistry';
import type { AppiumDriver } from '../types';

// ---------------------------------------------------------------------------
// Assertion / wait handlers
// All assertions use waitUntil — no hard sleeps.
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 300;

/** Find by accessibility label or text — simple probe used locally (SelectorResolver replaces this in Phase 3). */
async function probel(
    driver: AppiumDriver,
    target: string,
): Promise<WebdriverIO.Element> {
    return driver.$(`~${target}`);
}

// ---- assertVisible ---------------------------------------------------------

StepHandlerRegistry.register('assertVisible', async ({ driver, step, timeout }) => {
    if (step.kind !== 'assertVisible') return;
    const el = await probel(driver, step.target);
    await driver.waitUntil(
        () => el.isDisplayed(),
        {
            timeout,
            interval: POLL_INTERVAL_MS,
            timeoutMsg: `assertVisible: "${step.target}" not visible after ${timeout} ms`,
        },
    );
});

// ---- assertNotVisible ------------------------------------------------------

StepHandlerRegistry.register('assertNotVisible', async ({ driver, step, timeout }) => {
    if (step.kind !== 'assertNotVisible') return;
    await driver.waitUntil(
        async () => {
            try {
                const el = await probel(driver, step.target);
                return !(await el.isDisplayed());
            } catch {
                // Element not present at all — counts as not visible.
                return true;
            }
        },
        {
            timeout,
            interval: POLL_INTERVAL_MS,
            timeoutMsg: `assertNotVisible: "${step.target}" still visible after ${timeout} ms`,
        },
    );
});

// ---- assertChecked ---------------------------------------------------------

StepHandlerRegistry.register('assertChecked', async ({ driver, step, timeout }) => {
    if (step.kind !== 'assertChecked') return;
    const el = await probel(driver, step.target);
    await driver.waitUntil(
        async () => {
            const checked = await el.getAttribute('checked');
            return checked === 'true' || checked === 'checked';
        },
        {
            timeout,
            interval: POLL_INTERVAL_MS,
            timeoutMsg: `assertChecked: "${step.target}" is not checked after ${timeout} ms`,
        },
    );
});

// ---- assertEqual -----------------------------------------------------------

StepHandlerRegistry.register('assertEqual', async ({ driver, step, timeout }) => {
    if (step.kind !== 'assertEqual') return;
    const el = await driver.$(`~${step.id}`);
    await driver.waitUntil(
        async () => {
            const text = await el.getText();
            return text === step.value;
        },
        {
            timeout,
            interval: POLL_INTERVAL_MS,
            timeoutMsg: `assertEqual: "${step.id}" value never became "${step.value}" within ${timeout} ms`,
        },
    );
});

// ---- waitForVisible --------------------------------------------------------
// Same as assertVisible but does NOT throw on timeout — used as a sync point.

StepHandlerRegistry.register('waitForVisible', async ({ driver, step, timeout }) => {
    if (step.kind !== 'waitForVisible') return;
    try {
        const el = await probel(driver, step.target);
        await driver.waitUntil(() => el.isDisplayed(), {
            timeout,
            interval: POLL_INTERVAL_MS,
        });
    } catch {
        // Intentionally silent — this is a sync point, not an assertion.
    }
});

// ---- waitForNotVisible -----------------------------------------------------

StepHandlerRegistry.register('waitForNotVisible', async ({ driver, step, timeout }) => {
    if (step.kind !== 'waitForNotVisible') return;
    try {
        await driver.waitUntil(
            async () => {
                try {
                    const el = await probel(driver, step.target);
                    return !(await el.isDisplayed());
                } catch {
                    return true;
                }
            },
            { timeout, interval: POLL_INTERVAL_MS },
        );
    } catch {
        // Intentionally silent.
    }
});
