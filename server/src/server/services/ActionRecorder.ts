import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Data as WsData } from 'ws';

const execFileAsync = promisify(execFile);

export type RecordingMeta = {
    device?: string;
    source?: string;
    name?: string;
};

export type RecordedMessage = {
    at: number;
    data: string | Record<string, unknown>;
    binary: boolean;
};

export type RecordingFile = {
    id: string;
    remote: string;
    createdAt: string;
    name?: string;
    meta?: RecordingMeta;
    messages: RecordedMessage[];
};

export class ActionRecorder {
    private static readonly ROOT_DIR = path.resolve(process.cwd(), 'recordings');
    private static readonly ID_SAFE_RE = /[^a-zA-Z0-9-_]/g;
    private readonly startedAt = Date.now();
    private pausedAt?: number;
    private pausedDuration = 0;
    private readonly messages: RecordedMessage[] = [];

    constructor(
        private readonly id: string,
        private readonly remote: string,
        private readonly meta?: RecordingMeta,
    ) {}

    public static normalizeId(raw?: string | null): string | undefined {
        if (typeof raw !== 'string') {
            return undefined;
        }
        const trimmed = raw.trim();
        if (!trimmed) {
            return undefined;
        }
        if (trimmed === 'true' || trimmed === '1') {
            return this.createId();
        }
        return trimmed.replace(this.ID_SAFE_RE, '_');
    }

    public static createId(): string {
        return `session-${Date.now()}`;
    }

    public capture(data: WsData): void {
        const at = this.getElapsed();
        const { payload, isBinary } = ActionRecorder.encode(data);
        this.messages.push({
            at,
            data: payload,
            binary: isBinary,
        });
    }

    public pause(): void {
        if (this.pausedAt) {
            return;
        }
        this.pausedAt = Date.now();
    }

    public resume(): void {
        if (!this.pausedAt) {
            return;
        }
        this.pausedDuration += Date.now() - this.pausedAt;
        this.pausedAt = undefined;
    }

    public async persist(): Promise<string> {
        const dir = ActionRecorder.ROOT_DIR;
        await fs.promises.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, `${this.id}.json`);
        const recording: RecordingFile = {
            id: this.id,
            remote: this.remote,
            createdAt: new Date(this.startedAt).toISOString(),
            name: this.meta?.name,
            meta: this.meta,
            messages: [...this.messages],
        };
        await fs.promises.writeFile(filePath, JSON.stringify(recording, null, 2), 'utf8');
        return filePath;
    }

    public static async load(id: string): Promise<RecordingFile> {
        const safeId = this.normalizeId(id);
        if (!safeId) {
            throw new Error('Recording id is required');
        }
        const filePath = path.join(this.ROOT_DIR, `${safeId}.json`);
        const content = await fs.promises.readFile(filePath, 'utf8');
        const parsed = JSON.parse(content);
        if (!parsed || !Array.isArray(parsed.messages)) {
            throw new Error('Invalid recording file');
        }
        const messages: RecordedMessage[] = parsed.messages
            .map((item: any) => ({
                at: Number(item.at) || 0,
                data: typeof item.data === 'object' && item.data !== null ? item.data : String(item.data ?? ''),
                binary: Boolean(item.binary),
            }))
            .sort((a: RecordedMessage, b: RecordedMessage) => a.at - b.at);
        return {
            id: parsed.id || safeId,
            remote: parsed.remote,
            createdAt: parsed.createdAt,
            meta: parsed.meta,
            messages,
        };
    }

    public static isAdbMessage(message: RecordedMessage): boolean {
        return (
            !message.binary &&
            typeof message.data === 'object' &&
            message.data !== null &&
            (message.data as Record<string, unknown>).type === 'ADB_SHELL'
        );
    }

    public static async runAdbMessage(message: RecordedMessage, udid: string): Promise<string> {
        const obj = message.data as Record<string, unknown>;
        const command = String(obj.command ?? '');
        if (!command) {
            throw new Error('ADB_SHELL message has no command');
        }
        const args = ['-s', udid, 'shell', ...command.split(' ')];
        const { stdout, stderr } = await execFileAsync('adb', args);
        return (stdout + stderr).trim();
    }

    public static decodeMessage(message: RecordedMessage): WsData {
        if (message.binary) {
            return Buffer.from(message.data as string, 'base64');
        }
        if (typeof message.data === 'object' && message.data !== null) {
            const obj = message.data;
            if (obj.type === 'TOUCH') return ActionRecorder.decodeTouchObject(obj);
            if (obj.type === 'KEYCODE') return ActionRecorder.decodeKeycodeObject(obj);
            if (obj.type === 'SCROLL') return ActionRecorder.decodeScrollObject(obj);
        }
        return message.data as string;
    }

    private static readonly TOUCH_ACTIONS: Record<string, number> = { DOWN: 0, UP: 1, MOVE: 2, HOVER_MOVE: 3, CANCEL: 4, OUTSIDE: 5 };
    private static readonly TOUCH_ACTION_NAMES = ['DOWN', 'UP', 'MOVE', 'HOVER_MOVE', 'CANCEL', 'OUTSIDE'];
    private static readonly KEYCODE_ACTIONS: Record<string, number> = { DOWN: 0, UP: 1 };
    private static readonly KEYCODE_ACTION_NAMES = ['DOWN', 'UP'];

    private static decodeTouchObject(obj: Record<string, unknown>): Buffer {
        const buf = Buffer.alloc(29);
        buf[0] = 2;
        buf[1] = typeof obj.action === 'string' ? (ActionRecorder.TOUCH_ACTIONS[obj.action] ?? 0) : Number(obj.action ?? 0);
        buf.writeBigInt64BE(BigInt(Number(obj.pointerId ?? 0)), 2);
        buf.writeInt32BE(Number(obj.x ?? 0), 10);
        buf.writeInt32BE(Number(obj.y ?? 0), 14);
        buf.writeUInt16BE(Number(obj.screenW ?? 0), 18);
        buf.writeUInt16BE(Number(obj.screenH ?? 0), 20);
        buf.writeUInt16BE(Math.round(Number(obj.pressure ?? 0) * 65535), 22);
        buf.writeUInt32BE(Number(obj.actionButton ?? 0), 24);
        buf[28] = Number(obj.buttons ?? 0);
        return buf;
    }

    private static decodeKeycodeObject(obj: Record<string, unknown>): Buffer {
        const buf = Buffer.alloc(14);
        buf[0] = 0;
        buf[1] = typeof obj.action === 'string' ? (ActionRecorder.KEYCODE_ACTIONS[obj.action] ?? 0) : Number(obj.action ?? 0);
        buf.writeInt32BE(Number(obj.keycode ?? 0), 2);
        buf.writeInt32BE(Number(obj.repeat ?? 0), 6);
        buf.writeInt32BE(Number(obj.metaState ?? 0), 10);
        return buf;
    }

    private static decodeScrollObject(obj: Record<string, unknown>): Buffer {
        const buf = Buffer.alloc(21);
        buf[0] = 3;
        buf.writeInt32BE(Number(obj.x ?? 0), 1);
        buf.writeInt32BE(Number(obj.y ?? 0), 5);
        buf.writeUInt16BE(Number(obj.screenW ?? 0), 9);
        buf.writeUInt16BE(Number(obj.screenH ?? 0), 11);
        buf.writeInt32BE(Number(obj.scrollH ?? 0), 13);
        buf.writeInt32BE(Number(obj.scrollV ?? 0), 17);
        return buf;
    }

    private static encode(data: WsData): { payload: string | Record<string, unknown>; isBinary: boolean } {
        if (typeof data === 'string') {
            return { payload: data, isBinary: false };
        }
        let buf: Buffer;
        if (Buffer.isBuffer(data)) {
            buf = data;
        } else if (Array.isArray(data)) {
            buf = Buffer.concat(data);
        } else if (data instanceof ArrayBuffer) {
            buf = Buffer.from(data);
        } else {
            return { payload: String(data), isBinary: false };
        }
        if (buf.length > 0) {
            const msgType = buf[0];
            // TOUCH: type=2, 29 bytes
            if (msgType === 2 && buf.length === 29) {
                return {
                    payload: {
                        type: 'TOUCH',
                        action: ActionRecorder.TOUCH_ACTION_NAMES[buf[1]] ?? buf[1],
                        pointerId: Number(buf.readBigInt64BE(2)),
                        x: buf.readInt32BE(10),
                        y: buf.readInt32BE(14),
                        screenW: buf.readUInt16BE(18),
                        screenH: buf.readUInt16BE(20),
                        pressure: parseFloat((buf.readUInt16BE(22) / 65535).toFixed(4)),
                        actionButton: buf.readUInt32BE(24),
                        buttons: buf[28],
                    },
                    isBinary: false,
                };
            }
            // KEYCODE: type=0, 14 bytes
            if (msgType === 0 && buf.length === 14) {
                return {
                    payload: {
                        type: 'KEYCODE',
                        action: ActionRecorder.KEYCODE_ACTION_NAMES[buf[1]] ?? buf[1],
                        keycode: buf.readInt32BE(2),
                        repeat: buf.readInt32BE(6),
                        metaState: buf.readInt32BE(10),
                    },
                    isBinary: false,
                };
            }
            // SCROLL: type=3, 21 bytes
            if (msgType === 3 && buf.length === 21) {
                return {
                    payload: {
                        type: 'SCROLL',
                        x: buf.readInt32BE(1),
                        y: buf.readInt32BE(5),
                        screenW: buf.readUInt16BE(9),
                        screenH: buf.readUInt16BE(11),
                        scrollH: buf.readInt32BE(13),
                        scrollV: buf.readInt32BE(17),
                    },
                    isBinary: false,
                };
            }
        }
        return { payload: buf.toString('base64'), isBinary: true };
    }

    private getElapsed(): number {
        const pausedDelta = this.pausedAt ? Date.now() - this.pausedAt : 0;
        return Date.now() - this.startedAt - this.pausedDuration - pausedDelta;
    }
}
