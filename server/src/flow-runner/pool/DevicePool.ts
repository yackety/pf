import fs from 'fs';
import { parse as parseYaml } from 'yaml';
import type { DeviceRecord } from '../types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DevicePoolTimeout extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DevicePoolTimeout';
    }
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const pool: DeviceRecord[] = [];
const busy = new Set<string>(); // udids currently in use

const ACQUIRE_TIMEOUT_MS = 60_000;
const ACQUIRE_POLL_MS = 500;

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

interface PoolConfig {
    devices: Array<{
        udid: string;
        platform: 'android' | 'ios';
        osVersion: string;
        tags?: string[];
    }>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const DevicePool = {
    /**
     * Load devices from `device-pool.config.yml`.
     * Must be called once before `acquire()` (e.g. in globalSetup).
     * Calling `init()` again replaces the pool — safe to call in tests.
     */
    init(configPath: string): void {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const config = parseYaml(raw) as PoolConfig;

        if (!Array.isArray(config?.devices)) {
            throw new Error(`DevicePool: "devices" array not found in ${configPath}`);
        }

        pool.length = 0;
        busy.clear();

        for (const d of config.devices) {
            if (!d.udid || !d.platform || !d.osVersion) {
                throw new Error(
                    `DevicePool: device entry missing required field(s) in ${configPath}: ${JSON.stringify(d)}`,
                );
            }
            pool.push({
                udid: d.udid,
                platform: d.platform,
                osVersion: d.osVersion,
                tags: d.tags ?? [],
                appiumPort: null,
            });
        }
    },

    /**
     * Acquire a free device matching `platform` and all `requiredTags`.
     * If `pinnedUdid` is provided, waits specifically for that device.
     *
     * Spins with 500 ms polling up to 60 s, then throws `DevicePoolTimeout`.
     */
    acquire(
        platform: 'android' | 'ios',
        requiredTags: string[] = [],
        pinnedUdid?: string,
    ): Promise<DeviceRecord> {
        return new Promise((resolve, reject) => {
            const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;

            function attempt() {
                // Find a matching free device
                const candidate = pool.find((d) => {
                    if (busy.has(d.udid)) return false;
                    if (d.platform !== platform) return false;
                    if (pinnedUdid && d.udid !== pinnedUdid) return false;
                    if (requiredTags.length > 0 && !requiredTags.every((t) => d.tags.includes(t))) return false;
                    return true;
                });

                if (candidate) {
                    busy.add(candidate.udid);
                    resolve(candidate);
                    return;
                }

                if (Date.now() >= deadline) {
                    const desc = pinnedUdid
                        ? `device ${pinnedUdid}`
                        : `${platform} device with tags [${requiredTags.join(', ')}]`;
                    reject(
                        new DevicePoolTimeout(
                            `DevicePool: timed out waiting for ${desc} after ${ACQUIRE_TIMEOUT_MS / 1000} s`,
                        ),
                    );
                    return;
                }

                setTimeout(attempt, ACQUIRE_POLL_MS);
            }

            attempt();
        });
    },

    /**
     * Release a device back to the pool so another runner can acquire it.
     */
    release(udid: string): void {
        busy.delete(udid);
    },

    /**
     * Update the appiumPort on a device record after the Appium server has started.
     */
    setPort(udid: string, port: number): void {
        const device = pool.find((d) => d.udid === udid);
        if (device) device.appiumPort = port;
    },

    /** Returns the full list of devices (for globalSetup iteration). */
    devices(): ReadonlyArray<DeviceRecord> {
        return pool;
    },

    /** Returns whether a device is currently acquired. */
    isBusy(udid: string): boolean {
        return busy.has(udid);
    },
};
