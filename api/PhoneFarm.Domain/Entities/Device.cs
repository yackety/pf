namespace PhoneFarm.Domain.Entities;

public class Device
{
    public int Id { get; set; }
    public string Udid { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public int? AgentId { get; set; }
    public string State { get; set; } = string.Empty;
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? OsVersion { get; set; }
    public string? SdkVersion { get; set; }
    public string? CpuAbi { get; set; }
    public string? WifiInterface { get; set; }
    public string? IpAddresses { get; set; }
    public string? DeviceName { get; set; }
    public string? RawProps { get; set; }
    public string? Tags { get; set; }
    public string? Notes { get; set; }
    public DateTime FirstSeenAt { get; set; }
    public DateTime LastSeenAt { get; set; }
    public DateTime? LastStateChangeAt { get; set; }

    public Agent? Agent { get; set; }
    public ICollection<DeviceAccount> DeviceAccounts { get; set; } = [];
    public ICollection<DeviceSessionLog> SessionLogs { get; set; } = [];
}
