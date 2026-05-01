import * as sql from 'mssql';
import { DeviceState } from '../../common/DeviceState';
import ApplDeviceDescriptor from '../../types/ApplDeviceDescriptor';
import GoogDeviceDescriptor from '../../types/GoogDeviceDescriptor';
import { NetInterface } from '../../types/NetInterface';
import { AgentSyncService } from '../services/AgentSyncService';
import { DbService } from '../services/DbService';

/**
 * Hooks into ControlCenter 'device' events and upserts device rows into MSSQL.
 * Also appends DeviceSessionLog rows on state transitions.
 */
export class DeviceDbSync {
    private static previousStates = new Map<string, string>();
    /** Tracks the last known WiFi IP per device (null = no IP / disconnected). */
    private static previousWifiIps = new Map<string, string | null>();

    // -----------------------------------------------------------------------
    // Android
    // -----------------------------------------------------------------------
    public static handleGoog(descriptor: GoogDeviceDescriptor): void {
        const db = DbService.getInstance();
        const agentDbId = AgentSyncService.getInstance().getAgentDbId();

        const udid = descriptor.udid;
        const state = descriptor.state;
        const previousState = DeviceDbSync.previousStates.get(udid);
        const stateChanged = previousState !== undefined && previousState !== state;
        DeviceDbSync.previousStates.set(udid, state);

        // Detect WiFi internet connectivity changes
        const currentWifiIp = DeviceDbSync.resolveWifiIp(descriptor.interfaces, descriptor['wifi.interface']);
        if (DeviceDbSync.previousWifiIps.has(udid)) {
            const prevWifiIp = DeviceDbSync.previousWifiIps.get(udid)!;
            const wasConnected = prevWifiIp !== null;
            const isConnected = currentWifiIp !== null;
            if (wasConnected !== isConnected) {
                DeviceDbSync.logWifiChange(udid, prevWifiIp, currentWifiIp);
            }
        }
        DeviceDbSync.previousWifiIps.set(udid, currentWifiIp);

        const ipAddresses = DeviceDbSync.serializeInterfaces(descriptor.interfaces);
        const rawProps = JSON.stringify(descriptor);

        db.fire(async (pool) => {
            const now = new Date();
            const req = pool.request()
                .input('Udid',         sql.NVarChar(100),  udid)
                .input('Platform',     sql.NVarChar(10),   'android')
                .input('AgentDbId',    sql.Int,            agentDbId ?? null)
                .input('State',        sql.NVarChar(50),   state)
                .input('Manufacturer', sql.NVarChar(100),  descriptor['ro.product.manufacturer'] ?? null)
                .input('Model',        sql.NVarChar(100),  descriptor['ro.product.model'] ?? null)
                .input('OsVersion',    sql.NVarChar(50),   descriptor['ro.build.version.release'] ?? null)
                .input('SdkVersion',   sql.NVarChar(20),   descriptor['ro.build.version.sdk'] ?? null)
                .input('CpuAbi',       sql.NVarChar(50),   descriptor['ro.product.cpu.abi'] ?? null)
                .input('WifiInterface',sql.NVarChar(50),   descriptor['wifi.interface'] ?? null)
                .input('IpAddresses',  sql.NVarChar(1000), ipAddresses)
                .input('RawProps',     sql.NVarChar(1000), rawProps.substring(0, 1000))
                .input('Now',          sql.DateTime2,      now)
                .input('StateChanged', sql.Bit,            stateChanged ? 1 : 0);

            await req.query(`
                MERGE Devices WITH (HOLDLOCK) AS target
                USING (SELECT @Udid AS Udid) AS src
                ON target.Udid = src.Udid
                WHEN MATCHED THEN
                    UPDATE SET
                        Platform      = @Platform,
                        AgentId       = @AgentDbId,
                        State         = @State,
                        Manufacturer  = @Manufacturer,
                        Model         = @Model,
                        OsVersion     = @OsVersion,
                        SdkVersion    = @SdkVersion,
                        CpuAbi        = @CpuAbi,
                        WifiInterface = @WifiInterface,
                        IpAddresses   = @IpAddresses,
                        RawProps      = @RawProps,
                        LastSeenAt    = @Now,
                        LastStateChangeAt = CASE WHEN @StateChanged = 1 THEN @Now ELSE LastStateChangeAt END
                WHEN NOT MATCHED THEN
                    INSERT (Udid, Platform, AgentId, State, Manufacturer, Model, OsVersion, SdkVersion, CpuAbi, WifiInterface, IpAddresses, RawProps, FirstSeenAt, LastSeenAt)
                    VALUES (@Udid, @Platform, @AgentDbId, @State, @Manufacturer, @Model, @OsVersion, @SdkVersion, @CpuAbi, @WifiInterface, @IpAddresses, @RawProps, @Now, @Now);
            `);
        });

        if (stateChanged) {
            DeviceDbSync.logStateChange(udid, previousState!, state);
        }
    }

    // -----------------------------------------------------------------------
    // iOS
    // -----------------------------------------------------------------------
    public static handleAppl(descriptor: ApplDeviceDescriptor): void {
        const db = DbService.getInstance();
        const agentDbId = AgentSyncService.getInstance().getAgentDbId();

        const udid = descriptor.udid;
        const state = descriptor.state;
        const previousState = DeviceDbSync.previousStates.get(udid);
        const stateChanged = previousState !== undefined && previousState !== state;
        DeviceDbSync.previousStates.set(udid, state);

        const rawProps = JSON.stringify(descriptor);

        db.fire(async (pool) => {
            const now = new Date();
            const req = pool.request()
                .input('Udid',       sql.NVarChar(100),  udid)
                .input('Platform',   sql.NVarChar(10),   'ios')
                .input('AgentDbId',  sql.Int,            agentDbId ?? null)
                .input('State',      sql.NVarChar(50),   state)
                .input('DeviceName', sql.NVarChar(100),  descriptor.name ?? null)
                .input('Model',      sql.NVarChar(100),  descriptor.model ?? null)
                .input('OsVersion',  sql.NVarChar(50),   descriptor.version ?? null)
                .input('RawProps',   sql.NVarChar(1000), rawProps.substring(0, 1000))
                .input('Now',        sql.DateTime2,      now)
                .input('StateChanged', sql.Bit,          stateChanged ? 1 : 0);

            await req.query(`
                MERGE Devices WITH (HOLDLOCK) AS target
                USING (SELECT @Udid AS Udid) AS src
                ON target.Udid = src.Udid
                WHEN MATCHED THEN
                    UPDATE SET
                        Platform    = @Platform,
                        AgentId     = @AgentDbId,
                        State       = @State,
                        DeviceName  = @DeviceName,
                        Model       = @Model,
                        OsVersion   = @OsVersion,
                        RawProps    = @RawProps,
                        LastSeenAt  = @Now,
                        LastStateChangeAt = CASE WHEN @StateChanged = 1 THEN @Now ELSE LastStateChangeAt END
                WHEN NOT MATCHED THEN
                    INSERT (Udid, Platform, AgentId, State, DeviceName, Model, OsVersion, RawProps, FirstSeenAt, LastSeenAt)
                    VALUES (@Udid, @Platform, @AgentDbId, @State, @DeviceName, @Model, @OsVersion, @RawProps, @Now, @Now);
            `);
        });

        if (stateChanged) {
            DeviceDbSync.logStateChange(udid, previousState!, state);
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    private static serializeInterfaces(interfaces: NetInterface[] | undefined): string | null {
        if (!interfaces || interfaces.length === 0) return null;
        const mapped = interfaces.map((iface) => ({
            iface: iface.name,
            ipv4: iface.ipv4,
        }));
        return JSON.stringify(mapped).substring(0, 1000);
    }

    /**
     * Returns the IPv4 address of the WiFi interface (e.g. wlan0), or null if not connected.
     * Falls back to any wlan* interface when the named interface is not found.
     */
    private static resolveWifiIp(interfaces: NetInterface[] | undefined, wifiInterface: string | undefined): string | null {
        if (!interfaces || !interfaces.length) return null;
        const named = wifiInterface ? interfaces.find((i) => i.name === wifiInterface) : undefined;
        const iface = named ?? interfaces.find((i) => i.name?.startsWith('wlan'));
        return iface?.ipv4 ?? null;
    }

    private static logStateChange(udid: string, oldState: string, newState: string): void {
        const agentDbId = AgentSyncService.getInstance().getAgentDbId();
        const event =
            newState === DeviceState.DISCONNECTED ? 'disconnected' :
            oldState === DeviceState.DISCONNECTED ? 'connected' :
            'state_changed';

        DbService.getInstance().fire(async (pool) => {
            // Resolve device PK
            const deviceRes = await pool.request()
                .input('Udid', sql.NVarChar(100), udid)
                .query<{ Id: number }>(`SELECT Id FROM Devices WHERE Udid = @Udid`);

            const deviceId = deviceRes.recordset[0]?.Id;
            if (!deviceId) return;

            await pool.request()
                .input('DeviceId',  sql.Int,         deviceId)
                .input('AgentDbId', sql.Int,          agentDbId ?? null)
                .input('Event',     sql.NVarChar(100), event)
                .input('OldState',  sql.NVarChar(50),  oldState)
                .input('NewState',  sql.NVarChar(50),  newState)
                .query(`
                    INSERT INTO DeviceSessionLog (DeviceId, AgentId, Event, OldState, NewState, OccurredAt)
                    VALUES (@DeviceId, @AgentDbId, @Event, @OldState, @NewState, GETUTCDATE())
                `);
        });
    }

    private static logWifiChange(udid: string, oldIp: string | null, newIp: string | null): void {
        const agentDbId = AgentSyncService.getInstance().getAgentDbId();
        const event = newIp !== null ? 'wifi_connected' : 'wifi_disconnected';

        DbService.getInstance().fire(async (pool) => {
            const deviceRes = await pool.request()
                .input('Udid', sql.NVarChar(100), udid)
                .query<{ Id: number }>(`SELECT Id FROM Devices WHERE Udid = @Udid`);

            const deviceId = deviceRes.recordset[0]?.Id;
            if (!deviceId) return;

            await pool.request()
                .input('DeviceId',  sql.Int,          deviceId)
                .input('AgentDbId', sql.Int,           agentDbId ?? null)
                .input('Event',     sql.NVarChar(100),  event)
                .input('OldState',  sql.NVarChar(50),   oldIp ?? '')
                .input('NewState',  sql.NVarChar(50),   newIp ?? '')
                .query(`
                    INSERT INTO DeviceSessionLog (DeviceId, AgentId, Event, OldState, NewState, OccurredAt)
                    VALUES (@DeviceId, @AgentDbId, @Event, @OldState, @NewState, GETUTCDATE())
                `);
        });
    }
}
