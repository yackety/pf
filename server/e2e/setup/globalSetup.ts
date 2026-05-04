import fs from 'fs';
import os from 'os';
import path from 'path';
import { AppiumServerManager } from '../../src/flow-runner/pool/AppiumServerManager';
import { DevicePool } from '../../src/flow-runner/pool/DevicePool';

/**
 * Jest globalSetup for e2e runs.
 *
 * 1. Load device pool from e2e/device-pool.config.yml
 * 2. Spawn one Appium server per device (in parallel)
 * 3. Write a { udid → port } map to a temp file so workers/teardown can share it
 * 4. Verify all Appium servers responded /status before Jest runs any test
 *
 * The temp-file path is written to process.env.APPIUM_PORT_MAP so the
 * spec file can read it back from the global Jest worker environment.
 * Note: globalSetup runs in a separate Node process from workers —
 * shared data flows through the filesystem, not memory.
 */
export default async function globalSetup(): Promise<void> {
    const configPath = path.resolve(__dirname, '..', 'device-pool.config.yml');

    // 1. Init pool
    DevicePool.init(configPath);
    const devices = DevicePool.devices();

    if (devices.length === 0) {
        throw new Error('DevicePool: no devices configured in device-pool.config.yml');
    }

    // 2. Spawn Appium servers in parallel
    const logDir = path.resolve(__dirname, '..', 'logs');
    fs.mkdirSync(logDir, { recursive: true });

    await Promise.all(
        devices.map(async (device) => {
            const logPath = path.join(logDir, `appium-${device.udid}.log`);
            const port = await AppiumServerManager.spawn(device.udid, logPath);
            DevicePool.setPort(device.udid, port);
            console.log(`[globalSetup] Appium ready — udid=${device.udid} port=${port}`);
        }),
    );

    // 3. Write port map to a temp file for workers and teardown
    const portMap: Record<string, number> = {};
    for (const device of devices) {
        const port = AppiumServerManager.getPort(device.udid);
        if (port !== undefined) portMap[device.udid] = port;
    }

    const portMapPath = path.join(os.tmpdir(), `appium-ports-${Date.now()}.json`);
    fs.writeFileSync(portMapPath, JSON.stringify(portMap, null, 2));

    // Expose path via env so workers' jest config can read it
    process.env.APPIUM_PORT_MAP = portMapPath;

    console.log(`[globalSetup] Port map written to ${portMapPath}`);
}
