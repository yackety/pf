import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import portfinder from 'portfinder';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServerEntry {
    port: number;
    proc: ChildProcess;
    logPath: string;
}

// ---------------------------------------------------------------------------
// Module-level state: udid → entry
// ---------------------------------------------------------------------------

const servers = new Map<string, ServerEntry>();

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const APPIUM_START_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 500;
/** Starting port for portfinder search. */
const BASE_PORT = 4723;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function waitForAppium(port: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;

        function poll() {
            const req = http.get(`http://127.0.0.1:${port}/status`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    scheduleRetry();
                }
                res.resume(); // drain body
            });
            req.on('error', scheduleRetry);
            req.setTimeout(1000, () => { req.destroy(); scheduleRetry(); });
        }

        function scheduleRetry() {
            if (Date.now() >= deadline) {
                reject(new Error(`Appium on port ${port} did not respond within ${timeoutMs} ms`));
                return;
            }
            setTimeout(poll, POLL_INTERVAL_MS);
        }

        poll();
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const AppiumServerManager = {
    /**
     * Spawn an Appium server for the given device UDID.
     * Returns the port the server is listening on.
     * If a server is already running for this UDID, returns its port immediately.
     *
     * Log paths:
     *   Jest: e2e/logs/appium-<udid>.log
     *   API:  logs/appium-<udid>.log
     *
     * The caller controls the log directory via `logDir` (default: `e2e/logs`).
     */
    async spawn(udid: string, logDir = path.resolve('e2e', 'logs')): Promise<number> {
        const existing = servers.get(udid);
        if (existing) return existing.port;

        const port = await portfinder.getPortPromise({ port: BASE_PORT });
        const logPath = path.join(logDir, `appium-${udid}.log`);
        fs.mkdirSync(logDir, { recursive: true });

        const logStream = fs.createWriteStream(logPath, { flags: 'a' });

        const proc = spawn(
            'appium',
            [
                '--port', String(port),
                '--log-level', 'warn',
                '--log-timestamp',
            ],
            {
                detached: false,
                env: { ...process.env },
            },
        );

        proc.stdout?.pipe(logStream);
        proc.stderr?.pipe(logStream);

        proc.on('exit', (code, signal) => {
            servers.delete(udid);
            if (code !== 0 && code !== null) {
                console.warn(
                    `[AppiumServerManager] Appium for ${udid} exited with code ${code} signal ${signal}`,
                );
            }
        });

        servers.set(udid, { port, proc, logPath });

        await waitForAppium(port, APPIUM_START_TIMEOUT_MS);
        return port;
    },

    /**
     * Send SIGTERM to the Appium process for the given UDID.
     * Resolves when the process has exited (or was already gone).
     */
    kill(udid: string): Promise<void> {
        return new Promise((resolve) => {
            const entry = servers.get(udid);
            if (!entry) {
                resolve();
                return;
            }
            entry.proc.once('exit', () => resolve());
            entry.proc.kill('SIGTERM');
            // Force-kill after 5 s if it does not respond to SIGTERM
            setTimeout(() => {
                if (servers.has(udid)) {
                    entry.proc.kill('SIGKILL');
                }
            }, 5_000);
        });
    },

    /** Kill all managed Appium servers. Useful in globalTeardown. */
    async killAll(): Promise<void> {
        await Promise.all([...servers.keys()].map((udid) => this.kill(udid)));
    },

    /** Returns the port for a running server, or undefined. */
    getPort(udid: string): number | undefined {
        return servers.get(udid)?.port;
    },

    /** Returns the log path for a running server, or undefined. */
    getLogPath(udid: string): string | undefined {
        return servers.get(udid)?.logPath;
    },
};
