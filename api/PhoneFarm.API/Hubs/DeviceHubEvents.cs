namespace PhoneFarm.API.Hubs;

public record DeviceStateChangedEvent(string Udid, string State, DateTime LastSeenAt);
public record DeviceConnectedEvent(string Udid, string Platform, string? Model);
public record DeviceDisconnectedEvent(string Udid);
public record AgentOnlineEvent(string AgentId);
public record AgentOfflineEvent(string AgentId);
