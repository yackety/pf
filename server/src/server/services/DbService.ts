import * as sql from 'mssql';
import { Config } from '../Config';

/**
 * Singleton SQL connection pool.
 * All writes are fire-and-forget — a DB failure must never crash the agent.
 */
export class DbService {
    private static instance?: DbService;
    private pool?: sql.ConnectionPool;
    private ready = false;

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

    /** Fire-and-forget helper — logs errors but never throws. */
    public fire(fn: (pool: sql.ConnectionPool) => Promise<void>): void {
        const pool = this.getPool();
        if (!pool) return;
        fn(pool).catch((err: Error) => {
            console.error('[DbService] Write error:', err.message);
        });
    }
}
