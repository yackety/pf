import * as sql from 'mssql';
import { Service } from './Service';
import { DbService } from './DbService';
import { Config } from '../Config';

/**
 * Registers this agent in the Agents table on startup and sends periodic heartbeats.
 * On shutdown (release) marks the agent offline.
 */
export class AgentSyncService implements Service {
    private static instance?: AgentSyncService;
    private heartbeatTimer?: ReturnType<typeof setInterval>;
    private agentDbId?: number;

    private constructor() {}

    public static getInstance(): AgentSyncService {
        if (!AgentSyncService.instance) {
            AgentSyncService.instance = new AgentSyncService();
        }
        return AgentSyncService.instance;
    }

    public static hasInstance(): boolean {
        return !!AgentSyncService.instance;
    }

    public getName(): string {
        return 'AgentSyncService';
    }

    public async start(): Promise<void> {
        const db = DbService.getInstance();
        await db.connect();

        const pool = db.getPool();
        if (!pool) return;

        await this.upsertAgent(pool);

        const intervalMs = Config.getInstance().agent.heartbeatIntervalSeconds * 1000;
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, intervalMs);
    }

    public release(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
        this.markOffline();
    }

    /** Returns the DB primary-key Id for this agent once registered (used by DeviceDbSync). */
    public getAgentDbId(): number | undefined {
        return this.agentDbId;
    }

    private async upsertAgent(pool: sql.ConnectionPool): Promise<void> {
        const { id: agentId, host } = Config.getInstance().agent;
        try {
            const result = await pool.request()
                .input('AgentId', sql.NVarChar(100), agentId)
                .input('Host', sql.NVarChar(255), host)
                .query<{ Id: number }>(`
                    MERGE Agents WITH (HOLDLOCK) AS target
                    USING (SELECT @AgentId AS AgentId) AS src
                    ON target.AgentId = src.AgentId
                    WHEN MATCHED THEN
                        UPDATE SET
                            Host = @Host,
                            IsOnline = 1,
                            LastHeartbeatAt = GETUTCDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (AgentId, Host, IsOnline, LastHeartbeatAt, RegisteredAt)
                        VALUES (@AgentId, @Host, 1, GETUTCDATE(), GETUTCDATE())
                    OUTPUT inserted.Id;
                `);
            this.agentDbId = result.recordset[0]?.Id;
            console.log(`[AgentSyncService] Registered as "${agentId}" (DB id=${this.agentDbId}).`);
        } catch (err) {
            console.error('[AgentSyncService] Failed to upsert agent:', (err as Error).message);
        }
    }

    private sendHeartbeat(): void {
        DbService.getInstance().fire(async (pool) => {
            const { id: agentId } = Config.getInstance().agent;
            await pool.request()
                .input('AgentId', sql.NVarChar(100), agentId)
                .query(`
                    UPDATE Agents
                    SET LastHeartbeatAt = GETUTCDATE(), IsOnline = 1
                    WHERE AgentId = @AgentId
                `);
        });
    }

    private markOffline(): void {
        DbService.getInstance().fire(async (pool) => {
            const { id: agentId } = Config.getInstance().agent;
            await pool.request()
                .input('AgentId', sql.NVarChar(100), agentId)
                .query(`UPDATE Agents SET IsOnline = 0 WHERE AgentId = @AgentId`);
            console.log('[AgentSyncService] Marked agent offline.');
        });
    }
}
