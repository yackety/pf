import { SelfHealingCache } from './SelfHealingCache';
import type { AppiumDriver, TapTarget } from './types';

// ---------------------------------------------------------------------------
// Strategy names (also written into StepResult.selectorStrategy)
// ---------------------------------------------------------------------------

export type StrategyName =
    | 'testId'
    | 'id'
    | 'accessibilityLabel'
    | 'uiautomator'
    | 'iosPredicate'
    | 'xpath'
    | 'cache';

// ---------------------------------------------------------------------------
// ResolvedElement — element + winning strategy
// ---------------------------------------------------------------------------

export interface ResolvedElement {
    element: WebdriverIO.Element;
    strategy: StrategyName;
}

// ---------------------------------------------------------------------------
// SelectorResolver
// ---------------------------------------------------------------------------

export const SelectorResolver = {
    /**
     * Resolve a target to a visible element, trying strategies 1-6 in priority
     * order and stopping at the first hit.
     *
     * Strategy priority:
     *   1. testId  → Android resource-id / iOS accessibilityIdentifier
     *   2. id      → Android resource-id / iOS element name
     *   3. Accessibility label (`~<text>`)
     *   4. Android UiSelector text match
     *   5. iOS predicate string
     *   6. XPath fallback
     *
     * On success the winning selector is written to the SelfHealingCache so
     * future lookups skip straight to the cached strategy.
     */
    async resolve(
        driver: AppiumDriver,
        target: string | TapTarget,
        platform: 'android' | 'ios',
        appId: string,
        timeout: number,
        appVersion = 'unknown',
    ): Promise<ResolvedElement> {
        const label = targetLabel(target);

        // --- cache hit ---
        const cached = SelfHealingCache.get(appId, appVersion, label);
        if (cached) {
            try {
                const el = await driver.$(cached.selector);
                await el.waitForDisplayed({ timeout });
                return { element: el, strategy: 'cache' };
            } catch {
                // cached selector stale — fall through to full probe
                SelfHealingCache.invalidate(appId, appVersion, label);
            }
        }

        // --- strategy probe ---
        const strategies = buildStrategies(target, platform, appId);
        const errors: string[] = [];

        for (const { name, selector } of strategies) {
            try {
                const el = await driver.$(selector);
                await el.waitForDisplayed({ timeout });
                // write winner to cache
                SelfHealingCache.set(appId, appVersion, label, { selector, strategy: name });
                return { element: el, strategy: name };
            } catch (e: unknown) {
                errors.push(`[${name}] ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        throw new Error(
            `SelectorResolver: element not found for "${label}" after trying all strategies.\n` +
            errors.join('\n'),
        );
    },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function targetLabel(target: string | TapTarget): string {
    if (typeof target === 'string') return target;
    return target.testId ?? target.id ?? target.xpath ?? JSON.stringify(target);
}

interface Strategy {
    name: StrategyName;
    selector: string;
}

function buildStrategies(
    target: string | TapTarget,
    platform: 'android' | 'ios',
    appId: string,
): Strategy[] {
    const list: Strategy[] = [];

    if (typeof target === 'object' && target.testId) {
        list.push({
            name: 'testId',
            selector:
                platform === 'android'
                    ? `id:${appId}:id/${target.testId}`
                    : `~${target.testId}`,
        });
    }

    if (typeof target === 'object' && target.id) {
        list.push({
            name: 'id',
            selector:
                platform === 'android'
                    ? `id:${appId}:id/${target.id}`
                    : `~${target.id}`,
        });
    }

    if (typeof target === 'object' && target.xpath) {
        list.push({ name: 'xpath', selector: target.xpath });
    }

    if (typeof target === 'string') {
        const text = target;

        list.push({ name: 'accessibilityLabel', selector: `~${text}` });

        if (platform === 'android') {
            list.push({
                name: 'uiautomator',
                selector: `-android uiautomator:new UiSelector().text("${text}")`,
            });
        }

        if (platform === 'ios') {
            list.push({
                name: 'iosPredicate',
                selector: `-ios predicate string:label == "${text}" OR value == "${text}"`,
            });
        }

        list.push({
            name: 'xpath',
            selector: `//*[@text='${text}' or @content-desc='${text}' or @label='${text}']`,
        });
    }

    return list;
}
