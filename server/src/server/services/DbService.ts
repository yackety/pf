import * as sql from 'mssql';
import { Config } from '../Config';

/**
 * Singleton SQL connection pool.
 * All writes are fire-and-forget — a DB failure must never crash the agent.
 * Operations queued before the pool is ready are flushed on connect.
 */
export class DbService {
    private static instance?: DbService;
    private pool?: sql.ConnectionPool;
    private ready = false;
    private pendingQueue: Array<(pool: sql.ConnectionPool) => Promise<void>> = [];

    private constructor() {}

    public static getInstance(): DbService {
        if (!DbService.instance) {
            DbService.instance = new DbService();
        }
        return DbService.instance;
    }

    public async connect(): Promise<void> {
        const { connectionString } = Config.getInstance().database;
        if (!connectionString) {
            console.warn('[DbService] No database.connectionString configured — DB sync disabled.');
            return;
        }
        try {
            // Pass the connection string directly; append pool max to avoid default of 10
            const pool = new sql.ConnectionPool(connectionString);
            await pool.connect();
            this.pool = pool;
            this.ready = true;
            console.log('[DbService] Connected to MSSQL.');
            this.flushQueue(pool);
        } catch (err) {
            console.error('[DbService] Failed to connect:', (err as Error).message);
        }
    }

    public async close(): Promise<void> {
        if (this.pool) {
            try {
                await this.pool.close();
            } catch {
                // ignore
            }
            this.pool = undefined;
            this.ready = false;
        }
    }

    /** Returns the pool. Returns undefined if DB is not configured / not connected. */
    public getPool(): sql.ConnectionPool | undefined {
        return this.ready ? this.pool : undefined;
    }

    /** Fire-and-forget helper — logs errors but never throws.
     *  If the pool is not ready yet, the operation is queued and executed on connect. */
    public fire(fn: (pool: sql.ConnectionPool) => Promise<void>): void {
        const pool = this.getPool();
        if (!pool) {
            this.pendingQueue.push(fn);
            return;
        }
        fn(pool).catch((err: Error) => {
            console.error('[DbService] Write error:', err.message);
        });
    }

    private flushQueue(pool: sql.ConnectionPool): void {
        if (this.pendingQueue.length === 0) return;
        console.log(`[DbService] Flushing ${this.pendingQueue.length} queued operation(s).`);
        const ops = this.pendingQueue.splice(0);
        for (const fn of ops) {
            fn(pool).catch((err: Error) => {
                console.error('[DbService] Queued write error:', err.message);
            });
        }
    }
}
