namespace PhoneFarm.Domain.Entities;

public class Agent
{
    public int Id { get; set; }
    public string AgentId { get; set; } = string.Empty;
    public string Host { get; set; } = string.Empty;
    public DateTime? LastHeartbeatAt { get; set; }
    public bool IsOnline { get; set; }
    public DateTime RegisteredAt { get; set; }

    public ICollection<Device> Devices { get; set; } = [];
    public ICollection<DeviceSessionLog> SessionLogs { get; set; } = [];
}
