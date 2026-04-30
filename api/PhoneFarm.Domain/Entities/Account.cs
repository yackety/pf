namespace PhoneFarm.Domain.Entities;

public class Account
{
    public int Id { get; set; }
    public int PlatformId { get; set; }
    public Guid Uuid { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string Status { get; set; } = "active";
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime? LastActivityAt { get; set; }

    public Platform Platform { get; set; } = null!;
    public ICollection<DeviceAccount> DeviceAccounts { get; set; } = [];
}
