namespace PhoneFarm.Application.Accounts.Dtos;

public record AccountDto(
    int Id,
    int PlatformId,
    string PlatformName,
    Guid Uuid,
    string Username,
    string? DisplayName,
    string? Email,
    string? Phone,
    string Status,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? LastLoginAt,
    DateTime? LastActivityAt);

public record AccountDetailDto(
    int Id,
    int PlatformId,
    string PlatformName,
    Guid Uuid,
    string Username,
    string? DisplayName,
    string? Email,
    string? Phone,
    string Status,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? LastLoginAt,
    DateTime? LastActivityAt,
    IReadOnlyList<LinkedDeviceDto> LinkedDevices);

public record LinkedDeviceDto(int DeviceId, string Udid, string Platform, string? Model, DateTime AssignedAt);

public record CreateAccountRequest(
    int PlatformId,
    string Username,
    string Password,
    string? DisplayName,
    string? Email,
    string? Phone,
    string? Notes);

public record UpdateAccountRequest(
    string? Username,
    string? Password,
    string? DisplayName,
    string? Email,
    string? Phone,
    string? Notes,
    string? Status);

public class AccountFilterQuery
{
    public int? PlatformId { get; init; }
    public string? Status { get; init; }
    public string? Search { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 50;
    public int Skip => (Page - 1) * PageSize;
}
