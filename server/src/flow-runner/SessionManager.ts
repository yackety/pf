import { remote } from 'webdriverio';
import type { AppiumDriver, DeviceRecord, FlowHeader } from './types';

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

const SESSION_DESTROY_TIMEOUT_MS = 5_000;

export const SessionManager = {
    /**
     * Create a WebdriverIO session connected to the Appium server running for
     * the given device.  Returns an `AppiumDriver` (extends WebdriverIO.Browser).
     *
     * - Implicit wait is set to 0 — all element waits are explicit (`waitUntil`).
     * - `resetApp: true` on the header sets `appium:noReset = false`, which
     *   causes Appium to terminate + clear the app before the session starts.
     */
    async create(header: FlowHeader, device: DeviceRecord): Promise<AppiumDriver> {
        if (!device.appiumPort) {
            throw new Error(
                `SessionManager: device ${device.udid} has no appiumPort — ` +
                'call AppiumServerManager.spawn() before creating a session.',
            );
        }

        const noReset = !header.resetApp;

        const capabilities =
            device.platform === 'android'
                ? {
                    platformName: 'Android',
                    'appium:udid': device.udid,
                    'appium:automationName': 'UiAutomator2',
                    'appium:noReset': noReset,
                    'appium:appPackage': header.appId,
                }
                : {
                    platformName: 'iOS',
                    'appium:udid': device.udid,
                    'appium:automationName': 'XCUITest',
                    'appium:noReset': noReset,
                    'appium:bundleId': header.appId,
                    'appium:wdaLaunchTimeout': 60_000,
                };

        const driver = (await remote({
            hostname: '127.0.0.1',
            port: device.appiumPort,
            path: '/',
            capabilities,
            logLevel: 'warn',
        })) as unknown as AppiumDriver;

        // Disable implicit waits — all waits are explicit in handlers.
        await driver.setTimeout({ implicit: 0 });

        return driver;
    },

    /**
     * Terminate the WebdriverIO session with a hard 5 s deadline.
     * Errors are swallowed — a failed teardown should never mask a test failure.
     */
    async destroy(driver: AppiumDriver): Promise<void> {
        const timeout = new Promise<void>((resolve) =>
            setTimeout(resolve, SESSION_DESTROY_TIMEOUT_MS),
        );
        try {
            await Promise.race([driver.deleteSession(), timeout]);
        } catch {
            // Ignore — session may have already closed (app crash, device disconnect, etc.)
        }
    },

    /**
     * Start screen recording via the Appium `mobile: startRecordingScreen` command.
     * No-op if the driver does not support it.
     */
    async startRecording(driver: AppiumDriver): Promise<void> {
        try {
            await driver.execute('mobile: startRecordingScreen', {});
        } catch (e: unknown) {
            console.warn('[SessionManager] startRecording failed (non-fatal):', (e as Error).message);
        }
    },

    /**
     * Stop screen recording and write the MP4 to `outputPath`.
     * Returns the path on success, undefined on failure.
     */
    async stopRecording(driver: AppiumDriver, outputPath: string): Promise<string | undefined> {
        const fs = await import('fs');
        const path = await import('path');
        try {
            const base64 = await driver.execute('mobile: stopRecordingScreen', {}) as string;
            if (!base64) return undefined;
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'));
            return outputPath;
        } catch (e: unknown) {
            console.warn('[SessionManager] stopRecording failed (non-fatal):', (e as Error).message);
            return undefined;
        }
    },
};
