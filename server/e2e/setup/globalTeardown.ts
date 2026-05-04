import fs from 'fs';
import { AppiumServerManager } from '../../src/flow-runner/pool/AppiumServerManager';

/**
 * Jest globalTeardown for e2e runs.
 *
 * 1. Kill all managed Appium servers
 * 2. Delete the temp port-map file written by globalSetup
 */
export default async function globalTeardown(): Promise<void> {
    // 1. Kill all Appium processes
    await AppiumServerManager.killAll();
    console.log('[globalTeardown] All Appium servers stopped.');

    // 2. Remove temp port-map file
    const portMapPath = process.env.APPIUM_PORT_MAP;
    if (portMapPath) {
        try {
            fs.unlinkSync(portMapPath);
            console.log(`[globalTeardown] Removed port map: ${portMapPath}`);
        } catch {
            // Non-fatal — file may already be gone
        }
    }
}
