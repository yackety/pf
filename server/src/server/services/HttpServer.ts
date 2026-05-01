import { execFile, spawn } from 'child_process';
import express, { Express } from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import path from 'path';
import * as process from 'process';
import swaggerUi from 'swagger-ui-express';
import { promisify } from 'util';
import { TypedEmitter } from '../../common/TypedEmitter';
import { Config } from '../Config';
import { EnvName } from '../EnvName';
import { DeviceListSocket } from '../mw/DeviceListSocket';
import { WebsocketProxy } from '../mw/WebsocketProxy';
import { Utils } from '../Utils';
import { ActionRecorder } from './ActionRecorder';
import { ConnectPreferenceService, ConnectType } from './ConnectPreferenceService';
import { KeepAwakeService } from './KeepAwakeService';
import { RecordingRepository } from './RecordingRepository';
import { Service } from './Service';
import { swaggerSpec } from './swagger';
import { SyncService } from './SyncService';
/// #if INCLUDE_GOOG
import WS from 'ws';
import VideoSettings from '../../common/VideoSettings';
import { AdbUtils } from '../goog-device/AdbUtils';
import { ControlCenter as GoogControlCenter } from '../goog-device/services/ControlCenter';
/// #endif

const DEFAULT_STATIC_DIR = path.join(__dirname, './public');
const execFileAsync = promisify(execFile);

const PATHNAME = process.env[EnvName.WS_SCRCPY_PATHNAME] || __PATHNAME__;
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

async function runAdbInstall(udid: string, apkPath: string): Promise<string> {
    const execAdb = (args: string[], label: string): Promise<string> =>
        new Promise((resolve, reject) => {
            const proc = spawn('adb', ['-s', udid, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
            let stdout = '';
            let stderr = '';
            const timeout = setTimeout(() => {
                proc.kill('SIGKILL');
                reject(new Error(`${label} timed out`));
            }, 120000);
            proc.stdout.on('data', (d) => (stdout += d.toString()));
            proc.stderr.on('data', (d) => (stderr += d.toString()));
            proc.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
            proc.on('close', (code) => {
                clearTimeout(timeout);
                const out = (stdout + '\n' + stderr).trim();
                if (code === 0) {
                    resolve(out);
                } else {
                    reject(new Error(out || `${label} failed (code ${code ?? 'unknown'})`));
                }
            });
        });

    const ext = path.extname(apkPath).toLowerCase();
    if (ext === '.xapk' || ext === '.zip') {
        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ws-scrcpy-xapk-'));
        try {
            await new Promise<void>((resolve, reject) => {
                const proc = spawn('unzip', ['-o', '-q', apkPath, '-d', tmpDir], { stdio: ['ignore', 'pipe', 'pipe'] });
                let stderr = '';
                proc.stderr.on('data', (d) => (stderr += d.toString()));
                proc.on('error', reject);
                proc.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(stderr || `unzip failed (code ${code})`));
                    }
                });
            });
            const apkFiles: string[] = [];
            const walk = async (dir: string) => {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        await walk(full);
                    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.apk')) {
                        apkFiles.push(full);
                    }
                }
            };
            await walk(tmpDir);
            if (!apkFiles.length) {
                throw new Error('No APK files found in xapk/zip');
            }
            apkFiles.sort((a, b) => {
                const al = path.basename(a).toLowerCase();
                const bl = path.basename(b).toLowerCase();
                const aBase = al.includes('base');
                const bBase = bl.includes('base');
                if (aBase !== bBase) return aBase ? -1 : 1;
                return al.localeCompare(bl);
            });
            const out = await execAdb(['install', '-r', ...apkFiles], 'adb install');
            if (out.toLowerCase().includes('success')) {
                return out || 'Success';
            }
            throw new Error(out || 'install failed');
        } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const remover = (fs.promises as any).rm ? (fs.promises as any).rm : fs.promises.rmdir;
            remover.call(fs.promises, tmpDir, { recursive: true, force: true }).catch(() => undefined);
        }
    }

    const remote = `/data/local/tmp/${path.basename(apkPath)}`;
    let pushed = false;
    try {
        await execAdb(['push', apkPath, remote], 'adb push');
        pushed = true;
        const out = await execAdb(['shell', 'pm', 'install', '-r', remote], 'pm install');
        if (out.toLowerCase().includes('success')) {
            return out || 'Success';
        }
        throw new Error(out || 'pm install failed');
    } finally {
        if (pushed) {
            execAdb(['shell', 'rm', remote], 'cleanup').catch(() => undefined);
        }
    }
}

async function runAdbCommand(args: string[], label: string): Promise<string> {
    try {
        const { stdout, stderr } = await execFileAsync('adb', args);
        const out = (stdout + '\n' + stderr).trim();
        return out;
    } catch (error: any) {
        const out = ((error?.stdout || '') + '\n' + (error?.stderr || '')).trim();
        const message = out || error?.message || `${label} failed`;
        throw new Error(message);
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ServerAndPort = {
    server: https.Server | http.Server;
    port: number;
};

interface HttpServerEvents {
    started: boolean;
}

export class HttpServer extends TypedEmitter<HttpServerEvents> implements Service {
    private static instance: HttpServer;
    private static PUBLIC_DIR = DEFAULT_STATIC_DIR;
    private static SERVE_STATIC = true;
    private servers: ServerAndPort[] = [];
    private mainApp?: Express;
    private started = false;

    protected constructor() {
        super();
    }

    public static getInstance(): HttpServer {
        if (!this.instance) {
            this.instance = new HttpServer();
        }
        return this.instance;
    }

    public static hasInstance(): boolean {
        return !!this.instance;
    }

    public static setPublicDir(dir: string): void {
        if (HttpServer.instance) {
            throw Error('Unable to change value after instantiation');
        }
        HttpServer.PUBLIC_DIR = dir;
    }

    public static setServeStatic(enabled: boolean): void {
        if (HttpServer.instance) {
            throw Error('Unable to change value after instantiation');
        }
        HttpServer.SERVE_STATIC = enabled;
    }

    public async getServers(): Promise<ServerAndPort[]> {
        if (this.started) {
            return [...this.servers];
        }
        return new Promise<ServerAndPort[]>((resolve) => {
            this.once('started', () => {
                resolve([...this.servers]);
            });
        });
    }

    public getName(): string {
        return `HTTP(s) Server Service`;
    }

    public async start(): Promise<void> {
        this.mainApp = express();
        // Parse JSON bodies for API endpoints
        this.mainApp.use(express.json({ limit: '50mb' }));
        // Basic CORS for API usage from dev clients (e.g. Vite on localhost:5173)
        this.mainApp.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, X-UDID, X-Filename, X-File-Size');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(204);
            }
            next();
        });
        // GET /api/docs — Swagger UI for exploring the agent HTTP API.
        this.mainApp.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
        if (HttpServer.SERVE_STATIC && HttpServer.PUBLIC_DIR) {
            this.mainApp.use(PATHNAME, express.static(HttpServer.PUBLIC_DIR));

            /// #if USE_WDA_MJPEG_SERVER

            const { MjpegProxyFactory } = await import('../mw/MjpegProxyFactory');
            // GET /mjpeg/:udid — Proxy the MJPEG video stream from a WDA (WebDriverAgent) device.
            this.mainApp.get('/mjpeg/:udid', new MjpegProxyFactory().proxyRequest);
            /// #endif
        }
        /// #if INCLUDE_GOOG
        // POST /api/goog/device/pid — Get the running scrcpy server PID for a specific Android device.
        // Body: { udid: string }
        // Returns: { success, pid }
        this.mainApp.post('/api/goog/device/pid', async (req, res) => {
            const { udid } = req.body || {};
            if (typeof udid !== 'string' || !udid) {
                return res.status(400).json({ success: false, error: 'Invalid "udid"' });
            }
            try {
                const controlCenter = GoogControlCenter.getInstance();
                const pid = await controlCenter.getDevicePid(udid, 5000);
                if (typeof pid !== 'number') {
                    return res.status(404).json({ success: false, error: 'Server PID not found' });
                }
                return res.json({ success: true, pid });
            } catch (error: any) {
                const message = error?.message || 'Failed to get device pid';
                return res.status(500).json({ success: false, error: message });
            }
        });
        // POST /api/goog/device/config — Update the scrcpy video settings (crop region, bounds) for a device.
        // Body: { udid: string, videoSettings: { crop?, bounds?, ...rest } }
        // Returns: { success, videoSettings }
        this.mainApp.post('/api/goog/device/config', async (req, res) => {
            const { udid, videoSettings } = req.body || {};
            if (typeof udid !== 'string' || !udid) {
                return res.status(400).json({ success: false, error: 'Invalid "udid"' });
            }
            if (typeof videoSettings !== 'object' || videoSettings === null) {
                return res.status(400).json({ success: false, error: 'Invalid "videoSettings"' });
            }
            const { crop, bounds } = videoSettings;
            const validateRect = (rect: any) => {
                if (!rect) {
                    return null;
                }
                const required = ['left', 'top', 'right', 'bottom'];
                for (const key of required) {
                    if (typeof rect[key] !== 'number') {
                        throw new Error(`Invalid crop.${key}`);
                    }
                }
                return rect;
            };
            const validateSize = (size: any) => {
                if (!size) {
                    return null;
                }
                if (typeof size.width !== 'number' || typeof size.height !== 'number') {
                    throw new Error('Invalid bounds (width/height)');
                }
                return size;
            };
            try {
                const controlCenter = GoogControlCenter.getInstance();
                const normalized = {
                    ...videoSettings,
                    crop: validateRect(crop),
                    bounds: validateSize(bounds),
                };
                const settings: VideoSettings = controlCenter.setVideoSettings(udid, normalized);
                return res.json({ success: true, videoSettings: settings.toJSON() });
            } catch (error: any) {
                const message = error?.message || 'Failed to set video settings';
                return res.status(400).json({ success: false, error: message });
            }
        });
        // POST /api/goog/device/restart — Restart the scrcpy server on one or more Android devices.
        // Body: { udid?: string, udids?: string[], pid?: number }
        // Returns: { success, results: [{ udid, success, pid?, error? }] }
        this.mainApp.post('/api/goog/device/restart', async (req, res) => {
            const { udid, udids, pid } = req.body || {};
            const normalizedUdids = (Array.isArray(udids) ? udids : udid ? [udid] : [])
                .map((item) => (typeof item === 'string' ? item.trim() : ''))
                .filter(Boolean);
            if (!normalizedUdids.length) {
                return res.status(400).json({ success: false, error: 'Invalid "udids" or "udid"' });
            }
            // pid is optional; if missing/invalid, server will resolve current pid automatically
            const controlCenter = GoogControlCenter.getInstance();
            const results = await Promise.all(
                normalizedUdids.map(async (deviceUdid: string) => {
                    try {
                        const newPid = await controlCenter.restartDevice(deviceUdid, pid, 20000);
                        return { udid: deviceUdid, success: true, pid: newPid };
                    } catch (error: any) {
                        const message = error?.message || 'Failed to restart device';
                        return { udid: deviceUdid, success: false, error: message };
                    }
                }),
            );
            const allSuccess = results.every((item) => item.success);
            const response: Record<string, unknown> = { success: allSuccess, results };
            if (results.length === 1 && results[0].success) {
                response.pid = results[0].pid;
            }
            return res.status(allSuccess ? 200 : 207).json(response);
        });
        // POST /api/goog/device/send-binary — Send a raw binary payload to one or more devices via an ADB-forwarded WebSocket.
        // Body: { udid?: string, udids?: string[], remote?: string, dataBase64: string, path?: string, timeoutMs?: number }
        // Returns: { success, results: [{ udid, success, error? }] }
        this.mainApp.post('/api/goog/device/send-binary', async (req, res) => {
            const { udid, udids, remote = 'tcp:8886', dataBase64, path: wsPath = '', timeoutMs = 5000 } = req.body || {};
            const targets = (Array.isArray(udids) ? udids : udid ? [udid] : [])
                .map((item) => (typeof item === 'string' ? item.trim() : ''))
                .filter(Boolean);
            if (!targets.length) {
                return res.status(400).json({ success: false, error: 'Invalid "udids" or "udid"' });
            }
            if (typeof remote !== 'string' || !remote) {
                return res.status(400).json({ success: false, error: 'Invalid "remote"' });
            }
            if (typeof dataBase64 !== 'string' || !dataBase64) {
                return res.status(400).json({ success: false, error: 'Invalid "dataBase64"' });
            }
            let buffer: Buffer;
            try {
                buffer = Buffer.from(dataBase64, 'base64');
                if (!buffer.length) {
                    throw new Error('Empty buffer');
                }
            } catch (error: any) {
                return res.status(400).json({ success: false, error: error?.message || 'Invalid base64' });
            }

            const timeoutValue = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 5000;
            const sendToDevice = async (deviceUdid: string) => {
                try {
                    const port = await AdbUtils.forward(deviceUdid, remote);
                    const url = `ws://127.0.0.1:${port}${wsPath || ''}`;
                    await new Promise<void>((resolve, reject) => {
                        const ws = new WS(url);
                        const timer = setTimeout(() => {
                            ws.terminate();
                            reject(new Error('Timed out waiting for websocket'));
                        }, timeoutValue);
                        ws.on('open', () => {
                            ws.send(buffer, { binary: true }, (err) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                ws.close();
                            });
                        });
                        ws.on('error', (e) => {
                            clearTimeout(timer);
                            reject(e);
                        });
                        ws.on('close', () => {
                            clearTimeout(timer);
                            resolve();
                        });
                    });
                    return { udid: deviceUdid, success: true };
                } catch (error: any) {
                    const message = error?.message || 'Failed to send data';
                    return { udid: deviceUdid, success: false, error: message };
                }
            };

            const results = await Promise.all(targets.map((deviceUdid) => sendToDevice(deviceUdid)));
            const allSuccess = results.every((r) => r.success);
            return res.status(allSuccess ? 200 : 207).json({ success: allSuccess, results });
        });
        // POST /api/goog/device/install-apk — Receive a base64-encoded APK/XAPK and save it to the upload directory.
        // Returns the saved file path so a follow-up call to install-uploaded can install it.
        // Body: { udid: string, dataBase64: string, fileName?: string }
        // Returns: { success, filePath }
        this.mainApp.post('/api/goog/device/install-apk', async (req, res) => {
            const { udid, dataBase64, fileName } = req.body || {};
            if (typeof udid !== 'string' || !udid.trim()) {
                return res.status(400).json({ success: false, error: 'Invalid "udid"' });
            }
            if (typeof dataBase64 !== 'string' || !dataBase64) {
                return res.status(400).json({ success: false, error: 'Invalid "dataBase64"' });
            }
            const safeName =
                typeof fileName === 'string' && fileName.trim()
                    ? fileName.trim().replace(/[^a-zA-Z0-9_.-]/g, '_')
                    : 'upload.apk';
            let buffer: Buffer;
            try {
                buffer = Buffer.from(dataBase64, 'base64');
                if (!buffer.length) {
                    throw new Error('Empty buffer');
                }
            } catch (error: any) {
                return res.status(400).json({ success: false, error: error?.message || 'Invalid base64' });
            }
            const tmpPath = path.join(
                UPLOAD_DIR,
                `ws-scrcpy-upload-${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`,
            );
            try {
                await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
                await fs.promises.writeFile(tmpPath, buffer);
                return res.json({ success: true, filePath: tmpPath });
            } catch (error: any) {
                const message = error?.message || 'Failed to save apk';
                return res.status(500).json({ success: false, error: message });
            }
        });
        // POST /api/goog/device/install-apk-binary — Receive a raw binary APK/XAPK upload (multipart-free, Content-Type: */*)
        // and save it to the upload directory. Use X-UDID, X-Filename, and X-File-Size headers.
        // Returns: { success, filePath }
        this.mainApp.post(
            '/api/goog/device/install-apk-binary',
            express.raw({ limit: '200mb', type: '*/*' }),
            async (req, res) => {
                const udid = (req.header('x-udid') || req.query.udid || '').toString().trim();
                const fileNameHeader = (req.header('x-filename') || req.query.fileName || '').toString();
                const expectedSizeHeader = req.header('x-file-size');
                if (!udid) {
                    return res.status(400).json({ success: false, error: 'Invalid "udid"' });
                }
                const buffer = req.body as Buffer;
                if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
                    return res.status(400).json({ success: false, error: 'Empty apk payload' });
                }
                if (expectedSizeHeader) {
                    const expectedSize = parseInt(expectedSizeHeader.toString(), 10);
                    if (!isNaN(expectedSize) && expectedSize !== buffer.length) {
                        return res.status(400).json({
                            success: false,
                            error: `Size mismatch: got ${buffer.length}, expected ${expectedSize}`,
                        });
                    }
                }
                const safeName = fileNameHeader
                    ? fileNameHeader.trim().replace(/[^a-zA-Z0-9_.-]/g, '_')
                    : 'upload.apk';
                const tmpPath = path.join(
                    UPLOAD_DIR,
                    `ws-scrcpy-upload-${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`,
                );
                try {
                    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
                    await fs.promises.writeFile(tmpPath, buffer);
                    const stat = await fs.promises.stat(tmpPath);
                    if (expectedSizeHeader) {
                        const expectedSize = parseInt(expectedSizeHeader.toString(), 10);
                        if (!isNaN(expectedSize) && expectedSize !== stat.size) {
                            throw new Error(`Size mismatch after write: got ${stat.size}, expected ${expectedSize}`);
                        }
                    }
                    return res.json({ success: true, filePath: tmpPath });
                } catch (error: any) {
                    const message = error?.message || 'Failed to save apk';
                    return res.status(500).json({ success: false, error: message });
                }
            },
        );
        // POST /api/goog/device/install-uploaded — Install a previously uploaded APK/XAPK on a single device via ADB.
        // The filePath must be inside the upload directory (path-traversal is rejected).
        // Body: { udid: string, filePath: string }
        // Returns: { success, output }
        this.mainApp.post('/api/goog/device/install-uploaded', async (req, res) => {
            const { udid, filePath } = req.body || {};
            if (typeof udid !== 'string' || !udid.trim()) {
                return res.status(400).json({ success: false, error: 'Invalid "udid"' });
            }
            if (typeof filePath !== 'string' || !filePath.trim()) {
                return res.status(400).json({ success: false, error: 'Invalid "filePath"' });
            }
            // Ensure path is inside UPLOAD_DIR
            const resolved = path.resolve(filePath);
            if (!resolved.startsWith(UPLOAD_DIR)) {
                return res.status(400).json({ success: false, error: 'filePath not allowed' });
            }
            if (!fs.existsSync(resolved)) {
                return res.status(404).json({ success: false, error: 'file not found' });
            }
            try {
                const output = await runAdbInstall(udid.trim(), resolved);
                return res.json({ success: true, output });
            } catch (error: any) {
                const message = error?.message || 'Failed to install uploaded file';
                return res.status(500).json({ success: false, error: message });
            }
        });

        // POST /api/goog/device/install-bulk — Install the same already-uploaded APK/XAPK on multiple devices in parallel.
        // Body: { udids: string[], filePath: string }
        // Returns: { success, results: [{ udid, success, output?, error? }] }
        this.mainApp.post('/api/goog/device/install-bulk', async (req, res) => {
            const { udids, filePath } = req.body || {};
            const targetUdids: string[] = (Array.isArray(udids) ? udids : [])
                .map((u: any) => (typeof u === 'string' ? u.trim() : ''))
                .filter(Boolean);
            if (!targetUdids.length) {
                return res.status(400).json({ success: false, error: 'Invalid or empty "udids"' });
            }
            if (typeof filePath !== 'string' || !filePath.trim()) {
                return res.status(400).json({ success: false, error: 'Invalid "filePath"' });
            }
            const resolved = path.resolve(filePath);
            if (!resolved.startsWith(UPLOAD_DIR)) {
                return res.status(400).json({ success: false, error: 'filePath not allowed' });
            }
            if (!fs.existsSync(resolved)) {
                return res.status(404).json({ success: false, error: 'file not found' });
            }
            const results = await Promise.all(
                targetUdids.map(async (udid) => {
                    try {
                        const output = await runAdbInstall(udid, resolved);
                        return { udid, success: true, output };
                    } catch (error: any) {
                        return { udid, success: false, error: error?.message || 'Install failed' };
                    }
                }),
            );
            const allSuccess = results.every((r) => r.success);
            return res.status(allSuccess ? 200 : 207).json({ success: allSuccess, results });
        });

        // POST /api/goog/device/connect-wifi — Enable TCP/IP (WiFi) mode on one or more devices and attempt to connect.
        // Steps: (1) adb tcpip <port>, (2) adb connect <wifiIp>:<port> (skipped if no WiFi IP is available).
        // Body: { udid?: string, udids?: string[], port?: number }
        // Returns: { success, results: [{ udid, success, output?, error? }] }
        this.mainApp.post('/api/goog/device/connect-wifi', async (req, res) => {
            const { udid, udids, port = 5555 } = req.body || {};
            const targetUdids: string[] = (Array.isArray(udids) ? udids : udid ? [udid] : [])
                .map((u: any) => (typeof u === 'string' ? u.trim() : ''))
                .filter(Boolean);
            if (!targetUdids.length) {
                return res.status(400).json({ success: false, error: 'Provide "udid" or "udids"' });
            }
            const tcpPort = typeof port === 'number' && port > 0 && port < 65536 ? port : 5555;

            const runAdb = (args: string[]): Promise<string> =>
                new Promise((resolve, reject) => {
                    const proc = spawn('adb', args, { stdio: ['ignore', 'pipe', 'pipe'] });
                    let out = '';
                    proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
                    proc.stderr.on('data', (d: Buffer) => { out += d.toString(); });
                    proc.on('error', reject);
                    proc.on('close', () => resolve(out.trim()));
                });

            const controlCenter = GoogControlCenter.getInstance();

            const connectDevice = async (deviceUdid: string): Promise<{ udid: string; success: boolean; output?: string; error?: string }> => {
                try {
                    // Step 1: switch device to TCP/IP mode
                    const tcpipOut = await runAdb(['-s', deviceUdid, 'tcpip', String(tcpPort)]);

                    // Step 2: find WiFi IP from the descriptor (prefer wlan0)
                    const descriptor = controlCenter.getDevices().find(d => d.udid === deviceUdid);
                    const wifiIface = descriptor?.['wifi.interface'] || 'wlan0';
                    const ifaces: Array<{ name: string; ipv4: string }> = descriptor?.interfaces ?? [];
                    const wifiIp = ifaces.find(i => i.name === wifiIface)?.ipv4
                        ?? ifaces.find(i => i.name?.startsWith('wlan'))?.ipv4;

                    if (!wifiIp) {
                        return { udid: deviceUdid, success: true, output: `${tcpipOut} (no WiFi IP found; run "adb connect <ip>:${tcpPort}" manually)` };
                    }

                    // Step 3: connect over WiFi
                    const connectOut = await runAdb(['connect', `${wifiIp}:${tcpPort}`]);
                    const failed = connectOut.toLowerCase().includes('failed') || connectOut.toLowerCase().includes('error');
                    return { udid: deviceUdid, success: !failed, output: `${tcpipOut} | ${connectOut}` };
                } catch (error: any) {
                    return { udid: deviceUdid, success: false, error: error?.message || 'Unknown error' };
                }
            };

            const results = await Promise.all(targetUdids.map(connectDevice));
            const allSuccess = results.every(r => r.success);
            return res.status(allSuccess ? 200 : 207).json({ success: allSuccess, results });
        });

        // POST /api/goog/device/wifi-network — Connect one or more devices to a WiFi network (so they can access the internet).
        // Requires Android 10+. Uses "adb shell cmd wifi connect-network". Runs in parallel across all target devices.
        // Body: { udid?: string, udids?: string[], ssid: string, password?: string, security?: 'wpa2'|'wpa3'|'open' }
        //   security defaults to 'wpa2' when a password is provided, 'open' when no password is given.
        // Returns: { success, results: [{ udid, success, output?, error? }] }
        this.mainApp.post('/api/goog/device/wifi-network', async (req, res) => {
            const { udid, udids, ssid, password, security } = req.body || {};
            const targetUdids: string[] = (Array.isArray(udids) ? udids : udid ? [udid] : [])
                .map((u: any) => (typeof u === 'string' ? u.trim() : ''))
                .filter(Boolean);
            if (!targetUdids.length) {
                return res.status(400).json({ success: false, error: 'Provide "udid" or "udids"' });
            }
            if (typeof ssid !== 'string' || !ssid.trim()) {
                return res.status(400).json({ success: false, error: 'Invalid "ssid"' });
            }

            const hasPassword = typeof password === 'string' && password.length > 0;
            const securityType: string = typeof security === 'string' && security.trim()
                ? security.trim()
                : hasPassword ? 'wpa2' : 'open';

            const allowedSecurity = ['wpa2', 'wpa3', 'open'];
            if (!allowedSecurity.includes(securityType)) {
                return res.status(400).json({ success: false, error: `Invalid "security": must be one of ${allowedSecurity.join(', ')}` });
            }
            if (securityType !== 'open' && !hasPassword) {
                return res.status(400).json({ success: false, error: '"password" is required for non-open networks' });
            }

            const args = ['shell', 'cmd', 'wifi', 'connect-network', ssid.trim(), securityType];
            if (hasPassword) {
                args.push(password);
            }

            const results = await Promise.all(
                targetUdids.map(async (deviceUdid) => {
                    try {
                        const output = await runAdbCommand(['-s', deviceUdid, ...args], 'wifi connect-network');
                        // The command outputs "Network connection initiated" on success
                        const failed = output.toLowerCase().includes('error') || output.toLowerCase().includes('failed') || output.toLowerCase().includes('usage:');
                        if (failed) {
                            return { udid: deviceUdid, success: false, error: output || 'Failed to connect to WiFi network' };
                        }
                        return { udid: deviceUdid, success: true, output };
                    } catch (error: any) {
                        return { udid: deviceUdid, success: false, error: error?.message || 'Failed to connect to WiFi network' };
                    }
                }),
            );
            const allSuccess = results.every((r) => r.success);
            return res.status(allSuccess ? 200 : 207).json({ success: allSuccess, results });
        });

        // POST /api/goog/device/shell — Run a single ADB shell command on a device.
        // Body: { udid: string, command: string }
        // Returns: { success, output }
        this.mainApp.post('/api/goog/device/shell', async (req, res) => {
            const { udid, command } = req.body || {};
            if (typeof udid !== 'string' || !udid.trim()) {
                return res.status(400).json({ success: false, error: 'Invalid "udid"' });
            }
            if (typeof command !== 'string' || !command.trim()) {
                return res.status(400).json({ success: false, error: 'Invalid "command"' });
            }
            try {
                const output = await runAdbCommand(['-s', udid.trim(), 'shell', command.trim()], 'adb shell');
                return res.json({ success: true, output });
            } catch (error: any) {
                const message = error?.message || 'Shell command failed';
                return res.status(500).json({ success: false, error: message });
            }
        });

        // POST /api/goog/device/automate — Run a sequence of automation steps on a device.
        // Supported step types:
        //   { type: "open-url",  url: string }                          — open URL in Chrome
        //   { type: "shell",     command: string }                      — raw adb shell command
        //   { type: "tap",       x: number, y: number }                 — tap at coordinates
        //   { type: "swipe",     x: number, fromY: number, toY: number, durationMs?: number } — swipe (scroll)
        //   { type: "key",       keycode: number|string }               — press a keycode (e.g. 4 = BACK)
        //   { type: "text",      text: string }                         — type text into focused field
        //   { type: "wait",      ms: number }                           — pause execution
        // Body: { udid: string, steps: Step[] }
        // Returns: { success, results: [{ step, success, output?, error? }] }
        this.mainApp.post('/api/goog/device/automate', async (req, res) => {
            const { udid, steps } = req.body || {};
            if (typeof udid !== 'string' || !udid.trim()) {
                return res.status(400).json({ success: false, error: 'Invalid "udid"' });
            }
            if (!Array.isArray(steps) || !steps.length) {
                return res.status(400).json({ success: false, error: 'Invalid "steps": must be a non-empty array' });
            }

            const deviceUdid = udid.trim();
            const adb = (args: string[]) => runAdbCommand(['-s', deviceUdid, ...args], 'adb');

            const runStep = async (step: any, index: number): Promise<{ step: number; type: string; success: boolean; output?: string; error?: string }> => {
                const type = typeof step?.type === 'string' ? step.type : '';
                try {
                    switch (type) {
                        case 'open-url': {
                            const url = typeof step.url === 'string' ? step.url.trim() : '';
                            if (!url) throw new Error('"url" is required for open-url step');
                            const output = await adb([
                                'shell', 'am', 'start',
                                '-a', 'android.intent.action.VIEW',
                                '-d', url,
                                'com.android.chrome',
                            ]);
                            return { step: index, type, success: true, output };
                        }
                        case 'shell': {
                            const command = typeof step.command === 'string' ? step.command.trim() : '';
                            if (!command) throw new Error('"command" is required for shell step');
                            const output = await adb(['shell', command]);
                            return { step: index, type, success: true, output };
                        }
                        case 'tap': {
                            const x = step.x;
                            const y = step.y;
                            if (typeof x !== 'number' || typeof y !== 'number') throw new Error('"x" and "y" are required for tap step');
                            const output = await adb(['shell', 'input', 'tap', String(x), String(y)]);
                            return { step: index, type, success: true, output };
                        }
                        case 'swipe': {
                            const x = typeof step.x === 'number' ? step.x : 500;
                            const fromY = step.fromY;
                            const toY = step.toY;
                            const durationMs = typeof step.durationMs === 'number' && step.durationMs > 0 ? step.durationMs : 300;
                            if (typeof fromY !== 'number' || typeof toY !== 'number') throw new Error('"fromY" and "toY" are required for swipe step');
                            const output = await adb(['shell', 'input', 'swipe', String(x), String(fromY), String(x), String(toY), String(durationMs)]);
                            return { step: index, type, success: true, output };
                        }
                        case 'key': {
                            const keycode = step.keycode;
                            if (typeof keycode !== 'number' && typeof keycode !== 'string') throw new Error('"keycode" is required for key step');
                            const output = await adb(['shell', 'input', 'keyevent', String(keycode)]);
                            return { step: index, type, success: true, output };
                        }
                        case 'text': {
                            const text = typeof step.text === 'string' ? step.text : '';
                            if (!text) throw new Error('"text" is required for text step');
                            // Escape special characters for adb shell input text
                            const escaped = text.replace(/([\\$ "'`])/g, '\\$1').replace(/ /g, '%s');
                            const output = await adb(['shell', 'input', 'text', escaped]);
                            return { step: index, type, success: true, output };
                        }
                        case 'wait': {
                            const ms = typeof step.ms === 'number' && step.ms > 0 ? step.ms : 1000;
                            await delay(ms);
                            return { step: index, type, success: true, output: `Waited ${ms}ms` };
                        }
                        default:
                            throw new Error(`Unknown step type: "${type}"`);
                    }
                } catch (error: any) {
                    return { step: index, type, success: false, error: error?.message || 'Step failed' };
                }
            };

            // Steps run sequentially to preserve ordering
            const stepResults: Awaited<ReturnType<typeof runStep>>[] = [];
            for (let i = 0; i < steps.length; i++) {
                const result = await runStep(steps[i], i);
                stepResults.push(result);
                // Stop on failure so subsequent steps don't run in a broken state
                if (!result.success) {
                    break;
                }
            }
            const allSuccess = stepResults.every(r => r.success) && stepResults.length === steps.length;
            return res.status(allSuccess ? 200 : 207).json({ success: allSuccess, results: stepResults });
        });
        /// #endif
        // POST /api/recordings/start — Begin recording user actions for an active WebSocket proxy session.
        // Body: { session: string, recordId?: string }
        // Returns: { success, recordId }
        this.mainApp.post('/api/recordings/start', async (req, res) => {
            const { session, recordId } = req.body || {};
            if (typeof session !== 'string' || !session.trim()) {
                return res.status(400).json({ success: false, message: 'Invalid "session"' });
            }
            const proxy = WebsocketProxy.getBySession(session.trim());
            if (!proxy) {
                return res.status(404).json({ success: false, message: 'Session not found' });
            }
            try {
                const resolvedId = proxy.startRecording(recordId);
                return res.json({ success: true, recordId: resolvedId });
            } catch (error: any) {
                const message = error?.message || 'Failed to start recording';
                return res.status(400).json({ success: false, message });
            }
        });
        // POST /api/recordings/stop — Stop the active recording for a session and finalize the file.
        // Body: { session: string }
        // Returns: { success, ...recordingResult }
        this.mainApp.post('/api/recordings/stop', async (req, res) => {
            const { session } = req.body || {};
            if (typeof session !== 'string' || !session.trim()) {
                return res.status(400).json({ success: false, message: 'Invalid "session"' });
            }
            const proxy = WebsocketProxy.getBySession(session.trim());
            if (!proxy) {
                return res.status(404).json({ success: false, message: 'Session not found' });
            }
            try {
                const result = await proxy.stop();
                return res.json({ success: true, ...result });
            } catch (error: any) {
                const message = error?.message || 'Failed to stop recording';
                return res.status(400).json({ success: false, message });
            }
        });
        // POST /api/recordings/run — Replay a saved recording on an active WebSocket proxy session.
        // Body: { session: string, recordId: string }
        // Returns: { success }
        this.mainApp.post('/api/recordings/run', async (req, res) => {
            const { session, recordId } = req.body || {};
            const resolvedId = ActionRecorder.normalizeId(recordId);
            if (typeof session !== 'string' || !session.trim()) {
                return res.status(400).json({ success: false, message: 'Invalid "session"' });
            }
            if (!resolvedId) {
                return res.status(400).json({ success: false, message: 'Invalid "recordId"' });
            }
            const proxy = WebsocketProxy.getBySession(session.trim());
            if (!proxy) {
                return res.status(404).json({ success: false, message: 'Session not found' });
            }
            try {
                await proxy.runRecording(resolvedId);
                return res.json({ success: true });
            } catch (error: any) {
                const message = error?.message || 'Failed to run recording';
                return res.status(400).json({ success: false, message });
            }
        });
        // POST /api/recordings/pause — Pause an active recording or playback on a session.
        // Body: { session: string }
        // Returns: { success, mode }
        this.mainApp.post('/api/recordings/pause', async (req, res) => {
            const { session } = req.body || {};
            if (typeof session !== 'string' || !session.trim()) {
                return res.status(400).json({ success: false, message: 'Invalid "session"' });
            }
            const proxy = WebsocketProxy.getBySession(session.trim());
            if (!proxy) {
                return res.status(404).json({ success: false, message: 'Session not found' });
            }
            try {
                const mode = proxy.pause();
                return res.json({ success: true, mode });
            } catch (error: any) {
                const message = error?.message || 'Failed to pause';
                return res.status(400).json({ success: false, message });
            }
        });
        // POST /api/recordings/resume — Resume a paused recording or playback on a session.
        // Body: { session: string }
        // Returns: { success, mode }
        this.mainApp.post('/api/recordings/resume', async (req, res) => {
            const { session } = req.body || {};
            if (typeof session !== 'string' || !session.trim()) {
                return res.status(400).json({ success: false, message: 'Invalid "session"' });
            }
            const proxy = WebsocketProxy.getBySession(session.trim());
            if (!proxy) {
                return res.status(404).json({ success: false, message: 'Session not found' });
            }
            try {
                const mode = proxy.resume();
                return res.json({ success: true, mode });
            } catch (error: any) {
                const message = error?.message || 'Failed to resume';
                return res.status(400).json({ success: false, message });
            }
        });
        // POST /api/devices/connect — Switch one or more device connection modes between USB and WiFi.
        // Accepts a single object or an array for batch processing.
        // Body: { device: string, connect: 'wifi'|'usb', port?: number }[]
        // Returns: { success, results: [{ device, connect, success, error? }], devices }
        this.mainApp.post('/api/devices/connect', async (req, res) => {
            const payloads = Array.isArray(req.body) ? req.body : [req.body];
            if (!payloads.length) {
                return res.status(400).json({ success: false, error: 'Empty payload' });
            }
            const preferenceService = ConnectPreferenceService.getInstance();
            const resolveUuid = async (dev: string): Promise<string | undefined> => {
                if (dev.includes(':')) {
                    return DeviceListSocket.getSerial(dev);
                }
                return dev;
            };

            const processItem = async (
                item: any,
            ): Promise<{ device: string; connect?: string; success: boolean; error?: string }> => {
                const { device, connect, port: portRaw } = item || {};
                const connectType: ConnectType | undefined =
                    connect === 'wifi' ? 'wifi' : connect === 'usb' ? 'usb' : undefined;
                const deviceStr = typeof device === 'string' ? device.trim() : '';
                const portFromBody = typeof portRaw === 'number' && portRaw > 0 ? portRaw : undefined;
                if (!deviceStr || !connectType) {
                    return {
                        device: deviceStr || '',
                        connect,
                        success: false,
                        error: 'Invalid "device" or "connect"',
                    };
                }
                try {
                    if (connectType === 'usb') {
                        const uuid = await resolveUuid(deviceStr);
                        if (!uuid) {
                            throw new Error('Unable to resolve device uuid');
                        }
                        await execFileAsync('adb', ['-s', uuid, 'usb']);
                        const currentDevices = await DeviceListSocket.collectDevices();
                        const wifiPeers = currentDevices.filter(
                            (d) => d.uuid === uuid && d.connect_type === 'wifi' && d.device.includes(':'),
                        );
                        await Promise.all(
                            wifiPeers.map((peer) => execFileAsync('adb', ['disconnect', peer.device]).catch(() => undefined)),
                        );
                        if (deviceStr.includes(':')) {
                            await execFileAsync('adb', ['disconnect', deviceStr]).catch(() => undefined);
                        }
                        preferenceService.setPreference(uuid, 'usb');
                    } else {
                        const portFromDevice =
                            deviceStr.includes(':') && deviceStr.split(':')[1]
                                ? parseInt(deviceStr.split(':')[1], 10) || undefined
                                : undefined;
                        const targetPort = portFromBody ?? portFromDevice ?? 5555;
                        const uuid = deviceStr.includes(':') ? await resolveUuid(deviceStr) : deviceStr;
                        if (!uuid) {
                            throw new Error('Unable to resolve device uuid');
                        }
                        const hostPart = deviceStr.includes(':') ? deviceStr.split(':')[0] : '';
                        let target = '';
                        if (hostPart) {
                            target = `${hostPart}:${targetPort}`;
                        } else {
                            const ip = await DeviceListSocket.getDeviceIp(uuid);
                            if (!ip) {
                                throw new Error('Unable to resolve device ip');
                            }
                            target = `${ip}:${targetPort}`;
                        }
                        const connectOverWifi = async () => {
                            await runAdbCommand(['-s', uuid, 'tcpip', `${targetPort}`], 'adb tcpip');
                            await delay(400);
                            let connected = false;
                            let lastError: string | undefined;
                            for (let i = 0; i < 3 && !connected; i++) {
                                try {
                                    const out = await runAdbCommand(['connect', target], 'adb connect');
                                    lastError = out;
                                    if (
                                        out.toLowerCase().includes('connected to') ||
                                        out.toLowerCase().includes('already connected')
                                    ) {
                                        connected = true;
                                        break;
                                    }
                                } catch (err: any) {
                                    lastError = err?.message;
                                }
                                await delay(400);
                            }
                            if (!connected) {
                                throw new Error(lastError || 'Failed to connect over WiFi');
                            }
                        };
                        const TIMEOUT_MS = 10000;
                        let timeoutId: ReturnType<typeof setTimeout> | undefined;
                        try {
                            await Promise.race([
                                connectOverWifi(),
                                new Promise<void>((_, reject) => {
                                    timeoutId = setTimeout(() => {
                                        reject(new Error('WiFi connection timed out after 10 seconds'));
                                    }, TIMEOUT_MS);
                                }),
                            ]);
                        } finally {
                            if (timeoutId) {
                                clearTimeout(timeoutId);
                            }
                        }
                        preferenceService.setPreference(uuid, 'wifi');
                    }
                    return { device: deviceStr, connect: connectType, success: true };
                } catch (error: any) {
                    return {
                        device: deviceStr,
                        connect: connectType,
                        success: false,
                        error: error?.message || 'Failed to switch connection',
                    };
                }
            };

            const results = await Promise.all(payloads.map((p) => processItem(p)));
            const devices = await DeviceListSocket.collectDevices();
            const allSuccess = results.every((r) => r.success);
            return res.json({ success: allSuccess, results, devices });
        });
        // POST /api/device/keep-awake — Prevent the device screen from sleeping for a given duration.
        // Body: { device: string, seconds?: number }  (default: 30 s)
        // Returns: { success, device, durationMs }
        this.mainApp.post('/api/device/keep-awake', async (req, res) => {
            const { device, seconds } = req.body || {};
            const deviceStr = typeof device === 'string' ? device.trim() : '';
            if (!deviceStr) {
                return res.status(400).json({ success: false, error: 'Invalid "device"' });
            }
            const durationMs = typeof seconds === 'number' && seconds > 0 ? seconds * 1000 : 30000;
            try {
                await KeepAwakeService.getInstance().keepAwake(deviceStr, durationMs);
                return res.json({ success: true, device: deviceStr, durationMs });
            } catch (error: any) {
                const message = error?.message || 'Failed to keep screen awake';
                return res.status(500).json({ success: false, error: message });
            }
        });

        // ── File Management ───────────────────────────────────────────────────
        // Subfolder routing by extension:
        //   .apk / .xapk / .apks  → uploads/apk/
        //   image extensions       → uploads/images/
        //   video extensions       → uploads/videos/
        //   everything else        → uploads/other/

        const FILE_SUBFOLDERS: Record<string, string> = {
            apk: 'apk', xapk: 'apk', apks: 'apk',
            jpg: 'images', jpeg: 'images', png: 'images', gif: 'images',
            webp: 'images', bmp: 'images', svg: 'images',
            mp4: 'videos', mov: 'videos', avi: 'videos', mkv: 'videos',
        };

        const getSubfolder = (filename: string): string => {
            const ext = path.extname(filename).replace('.', '').toLowerCase();
            return FILE_SUBFOLDERS[ext] ?? 'other';
        };

        // GET /api/files — List all managed files grouped by subfolder.
        // Returns: { success, files: FileEntry[] }
        this.mainApp.get('/api/files', async (_req, res) => {
            try {
                const subfolders = ['apk', 'images', 'videos', 'other'];
                const files: object[] = [];
                for (const sub of subfolders) {
                    const dir = path.join(UPLOAD_DIR, sub);
                    if (!fs.existsSync(dir)) continue;
                    const entries = await fs.promises.readdir(dir);
                    for (const name of entries) {
                        const fullPath = path.join(dir, name);
                        const stat = await fs.promises.stat(fullPath).catch(() => null);
                        if (!stat || !stat.isFile()) continue;
                        files.push({
                            storedName: name,
                            subFolder: sub,
                            filePath: fullPath,
                            fileSize: stat.size,
                            createdAt: stat.birthtime,
                        });
                    }
                }
                return res.json({ success: true, files });
            } catch (error: any) {
                return res.status(500).json({ success: false, error: error?.message || 'Failed to list files' });
            }
        });

        // POST /api/files/upload — Upload a file (binary body). Detected subfolder from filename extension.
        // Headers: X-Filename (required), X-File-Size (optional for validation)
        // Returns: { success, storedName, subFolder, filePath, fileSize }
        this.mainApp.post(
            '/api/files/upload',
            express.raw({ limit: '500mb', type: '*/*' }),
            async (req, res) => {
                const rawName = (req.header('x-filename') || '').toString().trim();
                const expectedSizeHeader = req.header('x-file-size');
                if (!rawName) {
                    return res.status(400).json({ success: false, error: 'X-Filename header is required' });
                }
                const safeName = rawName.replace(/[^a-zA-Z0-9_.\-]/g, '_');
                const buffer = req.body as Buffer;
                if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
                    return res.status(400).json({ success: false, error: 'Empty file body' });
                }
                if (expectedSizeHeader) {
                    const expected = parseInt(expectedSizeHeader, 10);
                    if (!isNaN(expected) && expected !== buffer.length) {
                        return res.status(400).json({ success: false, error: `Size mismatch: got ${buffer.length}, expected ${expected}` });
                    }
                }
                const sub = getSubfolder(safeName);
                const dir = path.join(UPLOAD_DIR, sub);
                const storedName = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
                const filePath = path.join(dir, storedName);
                try {
                    await fs.promises.mkdir(dir, { recursive: true });
                    await fs.promises.writeFile(filePath, buffer);
                    const stat = await fs.promises.stat(filePath);
                    return res.json({ success: true, storedName, subFolder: sub, filePath, fileSize: stat.size });
                } catch (error: any) {
                    return res.status(500).json({ success: false, error: error?.message || 'Failed to save file' });
                }
            },
        );

        // DELETE /api/files — Delete a file by its absolute path (must be inside uploads/).
        // Body: { filePath: string }
        // Returns: { success }
        this.mainApp.delete('/api/files', async (req, res) => {
            const { filePath } = req.body || {};
            if (typeof filePath !== 'string' || !filePath.trim()) {
                return res.status(400).json({ success: false, error: 'Invalid "filePath"' });
            }
            const resolved = path.resolve(filePath);
            if (!resolved.startsWith(UPLOAD_DIR)) {
                return res.status(400).json({ success: false, error: 'filePath not allowed' });
            }
            if (!fs.existsSync(resolved)) {
                return res.status(404).json({ success: false, error: 'File not found' });
            }
            try {
                await fs.promises.unlink(resolved);
                return res.json({ success: true });
            } catch (error: any) {
                return res.status(500).json({ success: false, error: error?.message || 'Failed to delete file' });
            }
        });

        // GET /api/recordings — List all saved action recordings.
        // Returns: { success, records }
        this.mainApp.get('/api/recordings', async (_req, res) => {
            try {
                const records = await RecordingRepository.list();
                return res.json({ success: true, records });
            } catch (error: any) {
                const message = error?.message || 'Failed to list recordings';
                return res.status(500).json({ success: false, message });
            }
        });
        // POST /api/recordings/update-name — Rename a saved recording.
        // Body: { recordId: string, name: string }
        // Returns: { success }
        this.mainApp.post('/api/recordings/update-name', async (req, res) => {
            const { recordId, name } = req.body || {};
            if (typeof recordId !== 'string' || !recordId.trim()) {
                return res.status(400).json({ success: false, message: 'Invalid "recordId"' });
            }
            if (typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({ success: false, message: 'Invalid "name"' });
            }
            try {
                await RecordingRepository.updateName(recordId, name.trim());
                return res.json({ success: true });
            } catch (error: any) {
                const message = error?.message || 'Failed to update recording name';
                return res.status(400).json({ success: false, message });
            }
        });
        // POST /api/recordings/delete — Delete a saved recording by ID.
        // Body: { recordId: string }
        // Returns: { success }
        this.mainApp.post('/api/recordings/delete', async (req, res) => {
            const { recordId } = req.body || {};
            if (typeof recordId !== 'string' || !recordId.trim()) {
                return res.status(400).json({ success: false, message: 'Invalid "recordId"' });
            }
            try {
                await RecordingRepository.delete(recordId.trim());
                return res.json({ success: true });
            } catch (error: any) {
                const message = error?.message || 'Failed to delete recording';
                return res.status(400).json({ success: false, message });
            }
        });
        // GET /api/sync — List the current device sync mappings (target → sync devices).
        // Returns: { success, sync }
        this.mainApp.get('/api/sync', async (_req, res) => {
            try {
                const sync = SyncService.getInstance().list();
                return res.json({ success: true, sync });
            } catch (error: any) {
                const message = error?.message || 'Failed to list sync mapping';
                return res.status(500).json({ success: false, message });
            }
        });
        // POST /api/sync/set — Set a sync mapping so that actions on the target device(s) are mirrored to sync devices.
        // Body: { target_device: string | string[], sync_devices: string[] }
        // Returns: { success, sync }
        this.mainApp.post('/api/sync/set', async (req, res) => {
            const { target_device: targetDevice, sync_devices: syncDevices } = req.body || {};
            const targetList = Array.isArray(targetDevice) ? targetDevice : [targetDevice];
            const normalizedTargets = targetList
                .map((t) => (typeof t === 'string' ? t.trim() : ''))
                .filter(Boolean);
            if (!normalizedTargets.length) {
                return res.status(400).json({ success: false, message: 'Invalid "target_device"' });
            }
            if (!Array.isArray(syncDevices)) {
                return res.status(400).json({ success: false, message: 'Invalid "sync_devices"' });
            }
            const normalized = syncDevices.map((d) => (typeof d === 'string' ? d.trim() : '')).filter(Boolean);
            try {
                const sync = SyncService.getInstance().setMapping(normalizedTargets, normalized);
                return res.json({ success: true, sync });
            } catch (error: any) {
                const message = error?.message || 'Failed to set sync mapping';
                return res.status(400).json({ success: false, message });
            }
        });
        // POST /api/sync/clear — Remove all device sync mappings.
        // Returns: { success }
        this.mainApp.post('/api/sync/clear', async (req, res) => {
            try {
                SyncService.getInstance().clear();
                return res.json({ success: true });
            } catch (error: any) {
                const message = error?.message || 'Failed to clear sync mapping';
                return res.status(400).json({ success: false, message });
            }
        });
        const config = Config.getInstance();
        config.servers.forEach((serverItem) => {
            const { secure, port, redirectToSecure } = serverItem;
            let proto: string;
            let server: http.Server | https.Server;
            if (secure) {
                if (!serverItem.options) {
                    throw Error('Must provide option for secure server configuration');
                }
                server = https.createServer(serverItem.options, this.mainApp);
                proto = 'https';
            } else {
                const options = serverItem.options ? { ...serverItem.options } : {};
                proto = 'http';
                let currentApp = this.mainApp;
                let host = '';
                let port = 443;
                let doRedirect = false;
                if (redirectToSecure === true) {
                    doRedirect = true;
                } else if (typeof redirectToSecure === 'object') {
                    doRedirect = true;
                    if (typeof redirectToSecure.port === 'number') {
                        port = redirectToSecure.port;
                    }
                    if (typeof redirectToSecure.host === 'string') {
                        host = redirectToSecure.host;
                    }
                }
                if (doRedirect) {
                    currentApp = express();
                    currentApp.use(function (req, res) {
                        const url = new URL(`https://${host ? host : req.headers.host}${req.url}`);
                        if (port && port !== 443) {
                            url.port = port.toString();
                        }
                        return res.redirect(301, url.toString());
                    });
                }
                server = http.createServer(options, currentApp);
            }
            this.servers.push({ server, port });
            server.listen(port, () => {
                Utils.printListeningMsg(proto, port, PATHNAME);
            });
        });
        this.started = true;
        this.emit('started', true);
    }

    public release(): void {
        this.servers.forEach((item) => {
            item.server.close();
        });
    }
}
