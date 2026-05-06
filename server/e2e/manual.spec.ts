/**
 * e2e/manual.spec.ts
 *
 * Manual flow tests — every `it(...)` shows up as a separate test in VS Code
 * Test Explorer.  Click ▷ next to any test to run just that one.
 *
 * ── SETUP ────────────────────────────────────────────────────────────────────
 *  1. Find your UDID:
 *       iOS device:    xcrun devicectl list devices
 *       iOS simulator: xcrun simctl list devices booted
 *       Android:       adb devices
 *
 *  2. Set the constant below (or use an env variable — see the bottom section).
 *
 *  3. Click ▷ in Test Explorer (beaker icon in the sidebar).
 *
 * ── RULES ────────────────────────────────────────────────────────────────────
 *  UDIDs belong here only — never inside a .yml flow file.
 *  Don't commit real device UDIDs. Use environment variables in CI/shared repos.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { runFlow } from './helpers/runFlow';

// ── ✏️  Set your device UDIDs here ──────────────────────────────────────────
//   or override them via shell:  IOS_UDID=xxxx npm run flow:manual
const IOS_UDID     = process.env.IOS_UDID     ?? 'REPLACE_WITH_IOS_UDID';
const ANDROID_UDID = process.env.ANDROID_UDID ?? 'REPLACE_WITH_ANDROID_UDID';
// ─────────────────────────────────────────────────────────────────────────────

// =============================================================================
// iOS
// =============================================================================

describe('iOS', () => {

    it('login', () =>
        runFlow({
            yml:  'flows/login.yml',
            udid: IOS_UDID,
        }),
    );

    it('browsing', () =>
        runFlow({
            yml:  'flows/browsing.yml',
            udid: IOS_UDID,
        }),
    );

    it('login — custom credentials', () =>
        runFlow({
            yml:  'flows/login.yml',
            udid: IOS_UDID,
            env:  {
                USERNAME: 'myuser@example.com',
                PASSWORD: 'MyP@ssword',
            },
        }),
    );

});

// =============================================================================
// Android
// =============================================================================

describe('Android', () => {

    it('login', () =>
        runFlow({
            yml:  'flows/login.yml',
            udid: ANDROID_UDID,
        }),
    );

});
