import { SelectorResolver } from '../SelectorResolver';
import { StepHandlerRegistry } from '../StepHandlerRegistry';
import type { AppiumDriver, TapTarget } from '../types';

// ---------------------------------------------------------------------------
// Interaction handlers
// ---------------------------------------------------------------------------

// ---- element resolution helper ---------------------------------------------

async function resolve(
    driver: AppiumDriver,
    target: string | TapTarget,
    platform: 'android' | 'ios',
    appId: string,
    timeout: number,
): Promise<{ element: WebdriverIO.Element; strategy: string }> {
    return SelectorResolver.resolve(driver, target, platform, appId, timeout);
}

// ---- handlers --------------------------------------------------------------

StepHandlerRegistry.register('tapOn', async (ctx) => {
    if (ctx.step.kind !== 'tapOn') return;
    const { element, strategy } = await resolve(
        ctx.driver, ctx.step.target, ctx.header.platform, ctx.header.appId, ctx.timeout,
    );
    ctx.selectorStrategy = strategy;
    await element.click();
});

StepHandlerRegistry.register('longPressOn', async (ctx) => {
    if (ctx.step.kind !== 'longPressOn') return;
    const { element, strategy } = await resolve(
        ctx.driver, ctx.step.target, ctx.header.platform, ctx.header.appId, ctx.timeout,
    );
    ctx.selectorStrategy = strategy;
    await ctx.driver.touchAction([{ action: 'longPress', element }, { action: 'release' }]);
});

StepHandlerRegistry.register('doubleTapOn', async (ctx) => {
    if (ctx.step.kind !== 'doubleTapOn') return;
    const { element, strategy } = await resolve(
        ctx.driver, ctx.step.target, ctx.header.platform, ctx.header.appId, ctx.timeout,
    );
    ctx.selectorStrategy = strategy;
    await element.doubleClick();
});

StepHandlerRegistry.register('inputText', async ({ driver, step }) => {
    if (step.kind !== 'inputText') return;
    // Find the focused element (single round-trip; no key-by-key emulation).
    const active = await driver.getActiveElement();
    await active.setValue(step.text);
});

StepHandlerRegistry.register('clearText', async ({ driver }) => {
    const active = await driver.getActiveElement();
    await active.clearValue();
});

StepHandlerRegistry.register('hideKeyboard', async ({ driver }) => {
    await driver.hideKeyboard();
});

StepHandlerRegistry.register('scroll', async ({ driver, step, header }) => {
    if (step.kind !== 'scroll') return;
    const { direction } = step;

    if (header.platform === 'android') {
        await driver.execute('mobile: scrollGesture', {
            left: 200, top: 200, width: 400, height: 400,
            direction,
            percent: 0.75,
        });
    } else {
        await driver.execute('mobile: scroll', { direction });
    }
});

StepHandlerRegistry.register('scrollTo', async (ctx) => {
    if (ctx.step.kind !== 'scrollTo') return;
    const { element, strategy } = await resolve(
        ctx.driver, ctx.step.target, ctx.header.platform, ctx.header.appId, ctx.timeout,
    );
    ctx.selectorStrategy = strategy;
    await element.scrollIntoView();
});

StepHandlerRegistry.register('swipe', async ({ driver, step, header }) => {
    if (step.kind !== 'swipe') return;
    const [fx, fy] = step.from;
    const [tx, ty] = step.to;

    if (header.platform === 'android') {
        await driver.execute('mobile: swipeGesture', {
            left: fx, top: fy, width: tx - fx, height: ty - fy,
            direction: tx > fx ? 'right' : tx < fx ? 'left' : ty > fy ? 'down' : 'up',
            percent: 1.0,
        });
    } else {
        await driver.execute('mobile: swipe', {
            startX: fx, startY: fy,
            endX:   tx, endY:   ty,
        });
    }
});


// ---------------------------------------------------------------------------
// Interaction handlers
// ---------------------------------------------------------------------------

// ---- tap helpers -----------------------------------------------------------

/**
 * Resolve an element using the selector supplied by SelectorResolver (Phase 3).
 * For Phase 2 we use a lightweight inline resolution so the handlers are
 * fully testable without the real resolver.  SelectorResolver will replace
 * this behaviour in Phase 3.
 */
async function findElement(
    driver: AppiumDriver,
    target: string | TapTarget,
    platform: 'android' | 'ios',
    appId: string,
    timeout: number,
): Promise<WebdriverIO.Element> {
    // Delegate to SelectorResolver when available (Phase 3 will export this).
    // Until then, perform a simple ordered probe.
    const strategies: Array<() => Promise<WebdriverIO.Element>> = [];

    if (typeof target === 'object' && target.testId) {
        const sel =
            platform === 'android'
                ? `id:${appId}:id/${target.testId}`
                : `~${target.testId}`;
        strategies.push(() => driver.$(sel));
    }

    if (typeof target === 'object' && target.id) {
        const sel =
            platform === 'android'
                ? `id:${appId}:id/${target.id}`
                : `~${target.id}`;
        strategies.push(() => driver.$(sel));
    }

    if (typeof target === 'object' && target.xpath) {
        strategies.push(() => driver.$(target.xpath as string));
    }

    if (typeof target === 'string') {
        // accessibility label
        strategies.push(() => driver.$(`~${target}`));
        // Android UiSelector
        if (platform === 'android') {
            strategies.push(() =>
                driver.$(`-android uiautomator:new UiSelector().text("${target}")`),
            );
        }
        // iOS predicate
        if (platform === 'ios') {
            strategies.push(() =>
                driver.$(
                    `-ios predicate string:label == "${target}" OR value == "${target}"`,
                ),
            );
        }
        // XPath fallback
        strategies.push(() =>
            driver.$(
                `//*[@text='${target}' or @content-desc='${target}' or @label='${target}']`,
            ),
        );
    }

    const errors: string[] = [];
    for (const probe of strategies) {
        try {
            const el = await probe();
            await el.waitForDisplayed({ timeout });
            return el;
        } catch (e: unknown) {
            errors.push(e instanceof Error ? e.message : String(e));
        }
    }
    throw new Error(
        `Element not found for target: ${JSON.stringify(target)}\n${errors.join('\n')}`,
    );
}

// ---- handlers --------------------------------------------------------------

StepHandlerRegistry.register('tapOn', async ({ driver, step, header, timeout }) => {
    if (step.kind !== 'tapOn') return;
    const el = await findElement(driver, step.target, header.platform, header.appId, timeout);
    await el.click();
});

StepHandlerRegistry.register('longPressOn', async ({ driver, step, header, timeout }) => {
    if (step.kind !== 'longPressOn') return;
    const el = await findElement(driver, step.target, header.platform, header.appId, timeout);
    await driver.touchAction([{ action: 'longPress', element: el }, { action: 'release' }]);
});

StepHandlerRegistry.register('doubleTapOn', async ({ driver, step, header, timeout }) => {
    if (step.kind !== 'doubleTapOn') return;
    const el = await findElement(driver, step.target, header.platform, header.appId, timeout);
    await el.doubleClick();
});

StepHandlerRegistry.register('inputText', async ({ driver, step }) => {
    if (step.kind !== 'inputText') return;
    // Find the focused element (single round-trip; no key-by-key emulation).
    const active = await driver.getActiveElement();
    await active.setValue(step.text);
});

StepHandlerRegistry.register('clearText', async ({ driver }) => {
    const active = await driver.getActiveElement();
    await active.clearValue();
});

StepHandlerRegistry.register('hideKeyboard', async ({ driver }) => {
    await driver.hideKeyboard();
});

StepHandlerRegistry.register('scroll', async ({ driver, step, header }) => {
    if (step.kind !== 'scroll') return;
    const { direction } = step;

    if (header.platform === 'android') {
        await driver.execute('mobile: scrollGesture', {
            left: 200, top: 200, width: 400, height: 400,
            direction,
            percent: 0.75,
        });
    } else {
        await driver.execute('mobile: scroll', { direction });
    }
});

StepHandlerRegistry.register('scrollTo', async ({ driver, step, header, timeout }) => {
    if (step.kind !== 'scrollTo') return;
    const el = await findElement(driver, step.target, header.platform, header.appId, timeout);
    await el.scrollIntoView();
});

StepHandlerRegistry.register('swipe', async ({ driver, step, header }) => {
    if (step.kind !== 'swipe') return;
    const [fx, fy] = step.from;
    const [tx, ty] = step.to;

    if (header.platform === 'android') {
        await driver.execute('mobile: swipeGesture', {
            left: fx, top: fy, width: tx - fx, height: ty - fy,
            direction: tx > fx ? 'right' : tx < fx ? 'left' : ty > fy ? 'down' : 'up',
            percent: 1.0,
        });
    } else {
        await driver.execute('mobile: swipe', {
            startX: fx, startY: fy,
            endX:   tx, endY:   ty,
        });
    }
});
