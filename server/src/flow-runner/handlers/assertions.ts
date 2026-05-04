import { SelectorResolver } from '../SelectorResolver';
import { StepHandlerRegistry } from '../StepHandlerRegistry';
import type { AppiumDriver } from '../types';

// ---------------------------------------------------------------------------
// Assertion / wait handlers
// All assertions use waitUntil — no hard sleeps.
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 300;

async function resolveEl(
    driver: AppiumDriver,
    target: string,
    platform: 'android' | 'ios',
    appId: string,
    timeout: number,
): Promise<{ element: WebdriverIO.Element; strategy: string }> {
    return SelectorResolver.resolve(driver, target, platform, appId, timeout);
}

// ---- assertVisible ---------------------------------------------------------

StepHandlerRegistry.register('assertVisible', async (ctx) => {
    if (ctx.step.kind !== 'assertVisible') return;
    const { element, strategy } = await resolveEl(
        ctx.driver, ctx.step.target, ctx.header.platform, ctx.header.appId, ctx.timeout,
    );
    ctx.selectorStrategy = strategy;
    await ctx.driver.waitUntil(
        () => element.isDisplayed(),
        {
            timeout: ctx.timeout,
            interval: POLL_INTERVAL_MS,
            timeoutMsg: `assertVisible: "${ctx.step.target}" not visible after ${ctx.timeout} ms`,
        },
    );
});

// ---- assertNotVisible ------------------------------------------------------

StepHandlerRegistry.register('assertNotVisible', async (ctx) => {
    if (ctx.step.kind !== 'assertNotVisible') return;
    const { target } = ctx.step;
    await ctx.driver.waitUntil(
        async () => {
            try {
                const { element } = await resolveEl(
                    ctx.driver, target,
                    ctx.header.platform, ctx.header.appId, 1000,
                );
                return !(await element.isDisplayed());
            } catch {
                return true;
            }
        },
        {
            timeout: ctx.timeout,
            interval: POLL_INTERVAL_MS,
            timeoutMsg: `assertNotVisible: "${target}" still visible after ${ctx.timeout} ms`,
        },
    );
});

// ---- assertChecked ---------------------------------------------------------

StepHandlerRegistry.register('assertChecked', async (ctx) => {
    if (ctx.step.kind !== 'assertChecked') return;
    const { element, strategy } = await resolveEl(
        ctx.driver, ctx.step.target, ctx.header.platform, ctx.header.appId, ctx.timeout,
    );
    ctx.selectorStrategy = strategy;
    await ctx.driver.waitUntil(
        async () => {
            const checked = await element.getAttribute('checked');
            return checked === 'true' || checked === 'checked';
        },
        {
            timeout: ctx.timeout,
            interval: POLL_INTERVAL_MS,
            timeoutMsg: `assertChecked: "${ctx.step.target}" is not checked after ${ctx.timeout} ms`,
        },
    );
});

// ---- assertEqual -----------------------------------------------------------

StepHandlerRegistry.register('assertEqual', async (ctx) => {
    if (ctx.step.kind !== 'assertEqual') return;
    const { id, value } = ctx.step;
    const { element, strategy } = await resolveEl(
        ctx.driver, id, ctx.header.platform, ctx.header.appId, ctx.timeout,
    );
    ctx.selectorStrategy = strategy;
    await ctx.driver.waitUntil(
        async () => (await element.getText()) === value,
        {
            timeout: ctx.timeout,
            interval: POLL_INTERVAL_MS,
            timeoutMsg: `assertEqual: "${id}" value never became "${value}" within ${ctx.timeout} ms`,
        },
    );
});

// ---- waitForVisible --------------------------------------------------------

StepHandlerRegistry.register('waitForVisible', async (ctx) => {
    if (ctx.step.kind !== 'waitForVisible') return;
    try {
        const { element, strategy } = await resolveEl(
            ctx.driver, ctx.step.target, ctx.header.platform, ctx.header.appId, ctx.timeout,
        );
        ctx.selectorStrategy = strategy;
        await ctx.driver.waitUntil(() => element.isDisplayed(), {
            timeout: ctx.timeout,
            interval: POLL_INTERVAL_MS,
        });
    } catch {
        // Intentionally silent — this is a sync point, not a hard assertion.
    }
});

// ---- waitForNotVisible -----------------------------------------------------

StepHandlerRegistry.register('waitForNotVisible', async (ctx) => {
    if (ctx.step.kind !== 'waitForNotVisible') return;
    const { target } = ctx.step;
    try {
        await ctx.driver.waitUntil(
            async () => {
                try {
                    const { element } = await resolveEl(
                        ctx.driver, target,
                        ctx.header.platform, ctx.header.appId, 1000,
                    );
                    return !(await element.isDisplayed());
                } catch {
                    return true;
                }
            },
            { timeout: ctx.timeout, interval: POLL_INTERVAL_MS },
        );
    } catch {
        // Intentionally silent.
    }
});

