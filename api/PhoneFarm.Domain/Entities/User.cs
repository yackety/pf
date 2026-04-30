namespace PhoneFarm.Domain.Entities;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }

    public ICollection<DeviceAccount> DeviceAccountAssignments { get; set; } = [];
    public ICollection<UserRefreshToken> RefreshTokens { get; set; } = [];
}
