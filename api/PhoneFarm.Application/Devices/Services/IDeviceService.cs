using PhoneFarm.Application.Common;
using PhoneFarm.Application.Devices.Dtos;

namespace PhoneFarm.Application.Devices.Services;

public interface IDeviceService
{
    Task<PagedResult<DeviceDto>> GetAllAsync(DeviceFilterQuery filter, CancellationToken ct = default);
    Task<DeviceDto?> GetByUdidAsync(string udid, CancellationToken ct = default);
    Task<DeviceDto> UpdateMetaAsync(string udid, UpdateDeviceRequest request, CancellationToken ct = default);
    Task<PagedResult<SessionLogDto>> GetSessionLogAsync(string udid, PaginationQuery pagination, CancellationToken ct = default);
    Task<IReadOnlyList<DeviceAccountDto>> GetLinkedAccountsAsync(string udid, CancellationToken ct = default);
    Task<DeviceAccountDto> LinkAccountAsync(string udid, int accountId, int assignedByUserId, CancellationToken ct = default);
    Task UnlinkAccountAsync(string udid, int accountId, CancellationToken ct = default);
}
