namespace PhoneFarm.Domain.Entities;

public class DeviceAccount
{
    public int Id { get; set; }
    public int DeviceId { get; set; }
    public int AccountId { get; set; }
    public DateTime AssignedAt { get; set; }
    public DateTime? UnassignedAt { get; set; }
    public int? AssignedBy { get; set; }
    public string? Notes { get; set; }

    public Device Device { get; set; } = null!;
    public Account Account { get; set; } = null!;
    public User? AssignedByUser { get; set; }
}
