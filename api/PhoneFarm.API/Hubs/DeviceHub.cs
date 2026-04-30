using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace PhoneFarm.API.Hubs;

/// <summary>
/// Real-time hub that pushes device and agent state changes to Angular clients.
///
/// Events broadcast to clients:
///   DeviceStateChanged   { udid, state, lastSeenAt }
///   DeviceConnected      { udid, platform, model }
///   DeviceDisconnected   { udid }
///   AgentOnline          { agentId }
///   AgentOffline         { agentId }
/// </summary>
[Authorize]
public class DeviceHub : Hub
{
    // Clients join no special groups — all events are broadcast to all connected clients.
    // Groups could be added later for per-agent filtering.
}
