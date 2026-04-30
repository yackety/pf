namespace PhoneFarm.Application.Agents.Dtos;

public record AgentDto(
    int Id,
    string AgentId,
    string Host,
    bool IsOnline,
    DateTime? LastHeartbeatAt,
    DateTime RegisteredAt,
    int DeviceCount);

public record AgentDetailDto(
    int Id,
    string AgentId,
    string Host,
    bool IsOnline,
    DateTime? LastHeartbeatAt,
    DateTime RegisteredAt);
