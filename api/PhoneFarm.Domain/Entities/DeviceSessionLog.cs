namespace PhoneFarm.Domain.Entities;

public class DeviceSessionLog
{
    public long Id { get; set; }
    public int DeviceId { get; set; }
    public int? AgentId { get; set; }
    public string Event { get; set; } = string.Empty;
    public string? OldState { get; set; }
    public string? NewState { get; set; }
    public DateTime OccurredAt { get; set; }

    public Device Device { get; set; } = null!;
    public Agent? Agent { get; set; }
}
