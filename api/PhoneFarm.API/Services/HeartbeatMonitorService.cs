using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PhoneFarm.API.Hubs;
using PhoneFarm.Infrastructure.Data;

namespace PhoneFarm.API.Services;

/// <summary>
/// Background service that polls Agents.LastHeartbeatAt every 60 s.
/// Any agent that has not sent a heartbeat in the last 90 s is marked offline
/// and an AgentOffline event is broadcast to all SignalR clients.
/// When a previously-offline agent recovers an AgentOnline event is broadcast.
/// Also detects device state changes and broadcasts DeviceStateChanged /
/// DeviceConnected / DeviceDisconnected events.
/// </summary>
public class HeartbeatMonitorService : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan HeartbeatTimeout = TimeSpan.FromSeconds(90);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<DeviceHub> _hub;
    private readonly ILogger<HeartbeatMonitorService> _logger;

    // Track last-known states to detect transitions
    private readonly Dictionary<int, bool> _agentOnlineState = new();
    private readonly Dictionary<int, string> _deviceStateCache = new();

    public HeartbeatMonitorService(
        IServiceScopeFactory scopeFactory,
        IHubContext<DeviceHub> hub,
        ILogger<HeartbeatMonitorService> logger)
    {
        _scopeFactory = scopeFactory;
        _hub = hub;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("HeartbeatMonitorService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "HeartbeatMonitorService tick failed.");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<PhoneFarmDbContext>();

        await CheckAgentsAsync(db, ct);
        await CheckDevicesAsync(db, ct);
    }

    private async Task CheckAgentsAsync(PhoneFarmDbContext db, CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow - HeartbeatTimeout;
        var agents = await db.Agents.ToListAsync(ct);

        foreach (var agent in agents)
        {
            bool wasOnline = _agentOnlineState.GetValueOrDefault(agent.Id, agent.IsOnline);
            bool shouldBeOnline = agent.LastHeartbeatAt.HasValue && agent.LastHeartbeatAt.Value >= cutoff;

            if (shouldBeOnline != agent.IsOnline)
            {
                agent.IsOnline = shouldBeOnline;
                _logger.LogInformation(
                    "Agent '{AgentId}' is now {Status}.", agent.AgentId, shouldBeOnline ? "online" : "offline");
            }

            _agentOnlineState[agent.Id] = shouldBeOnline;

            // Broadcast transition events
            if (!wasOnline && shouldBeOnline)
            {
                await _hub.Clients.All.SendAsync("AgentOnline", new AgentOnlineEvent(agent.AgentId), ct);
            }
            else if (wasOnline && !shouldBeOnline)
            {
                await _hub.Clients.All.SendAsync("AgentOffline", new AgentOfflineEvent(agent.AgentId), ct);
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task CheckDevicesAsync(PhoneFarmDbContext db, CancellationToken ct)
    {
        var devices = await db.Devices.AsNoTracking().ToListAsync(ct);

        foreach (var device in devices)
        {
            bool isNew = !_deviceStateCache.TryGetValue(device.Id, out var prevState);
            string currState = device.State;

            if (isNew)
            {
                _deviceStateCache[device.Id] = currState;
                continue;
            }

            if (prevState == currState)
                continue;

            _deviceStateCache[device.Id] = currState;

            if (currState == "disconnected")
            {
                await _hub.Clients.All.SendAsync("DeviceDisconnected",
                    new DeviceDisconnectedEvent(device.Udid), ct);
            }
            else if (prevState == "disconnected")
            {
                await _hub.Clients.All.SendAsync("DeviceConnected",
                    new DeviceConnectedEvent(device.Udid, device.Platform, device.Model), ct);
            }

            await _hub.Clients.All.SendAsync("DeviceStateChanged",
                new DeviceStateChangedEvent(device.Udid, currState, device.LastSeenAt), ct);
        }
    }
}
