import { StepHandlerRegistry } from '../StepHandlerRegistry';

// ---------------------------------------------------------------------------
// App lifecycle handlers
// ---------------------------------------------------------------------------

StepHandlerRegistry.register('launchApp', async ({ driver, header }) => {
    await driver.activateApp(header.appId);
});

StepHandlerRegistry.register('restartApp', async ({ driver, header }) => {
    await driver.terminateApp(header.appId);
    await driver.activateApp(header.appId);
});

StepHandlerRegistry.register('stopApp', async ({ driver, header }) => {
    await driver.terminateApp(header.appId);
});

StepHandlerRegistry.register('clearApp', async ({ driver, header }) => {
    if (header.platform === 'android') {
        // UiAutomator2 supports clearApp directly
        await (driver as WebdriverIO.Browser).execute('mobile: clearApp', { appId: header.appId });
    } else {
        // iOS XCUITest has no clearApp command — terminate + relaunch is best-effort
        try {
            await driver.terminateApp(header.appId);
        } catch {
            // ignore if app was not running
        }
        await driver.activateApp(header.appId);
    }
});
