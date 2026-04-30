using PhoneFarm.Domain.Entities;

namespace PhoneFarm.Application.Devices.Dtos;

public record DeviceDto(
    int Id,
    string Udid,
    string Platform,
    string State,
    string? Manufacturer,
    string? Model,
    string? OsVersion,
    string? SdkVersion,
    string? DeviceName,
    string? IpAddresses,
    string? Tags,
    string? Notes,
    int? AgentId,
    DateTime FirstSeenAt,
    DateTime LastSeenAt,
    DateTime? LastStateChangeAt)
{
    public static DeviceDto FromEntity(Device d) => new(
        d.Id, d.Udid, d.Platform, d.State,
        d.Manufacturer, d.Model, d.OsVersion, d.SdkVersion,
        d.DeviceName, d.IpAddresses, d.Tags, d.Notes,
        d.AgentId, d.FirstSeenAt, d.LastSeenAt, d.LastStateChangeAt);
}

public record UpdateDeviceRequest(string? Tags, string? Notes);

public class DeviceFilterQuery
{
    public string? State { get; init; }
    public string? Platform { get; init; }
    public int? AgentId { get; init; }
    public string? Tag { get; init; }
    public string? Search { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 50;
    public int Skip => (Page - 1) * PageSize;
}

public record SessionLogDto(
    long Id,
    string Event,
    string? OldState,
    string? NewState,
    DateTime OccurredAt);

public record DeviceAccountDto(
    int DeviceAccountId,
    int AccountId,
    string Username,
    string? DisplayName,
    int PlatformId,
    string PlatformName,
    string Status,
    DateTime AssignedAt);

public record DeviceActionRequest(string Type, object? Params = null);
