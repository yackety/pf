using Microsoft.EntityFrameworkCore;
using PhoneFarm.Application.Common;
using PhoneFarm.Application.Devices.Dtos;
using PhoneFarm.Domain.Entities;
using PhoneFarm.Infrastructure.Data;

namespace PhoneFarm.Application.Devices.Services;

public class DeviceService : IDeviceService
{
    private readonly PhoneFarmDbContext _db;

    public DeviceService(PhoneFarmDbContext db) => _db = db;

    public async Task<PagedResult<DeviceDto>> GetAllAsync(DeviceFilterQuery filter, CancellationToken ct = default)
    {
        var query = _db.Devices.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filter.State))
            query = query.Where(d => d.State == filter.State);

        if (!string.IsNullOrWhiteSpace(filter.Platform))
            query = query.Where(d => d.Platform == filter.Platform);

        if (filter.AgentId.HasValue)
            query = query.Where(d => d.AgentId == filter.AgentId.Value);

        if (!string.IsNullOrWhiteSpace(filter.Tag))
            query = query.Where(d => d.Tags != null && d.Tags.Contains(filter.Tag));

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search;
            query = query.Where(d =>
                d.Udid.Contains(search) ||
                (d.Model != null && d.Model.Contains(search)) ||
                (d.Manufacturer != null && d.Manufacturer.Contains(search)) ||
                (d.DeviceName != null && d.DeviceName.Contains(search)));
        }

        var total = await query.CountAsync(ct);
        var data = await query
            .OrderByDescending(d => d.LastSeenAt)
            .Skip(filter.Skip)
            .Take(filter.PageSize)
            .Select(d => DeviceDto.FromEntity(d))
            .ToListAsync(ct);

        return PagedResult<DeviceDto>.From(data, total, filter.Page, filter.PageSize);
    }

    public async Task<DeviceDto?> GetByUdidAsync(string udid, CancellationToken ct = default)
    {
        var device = await _db.Devices.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Udid == udid, ct);

        return device is null ? null : DeviceDto.FromEntity(device);
    }

    public async Task<DeviceDto> UpdateMetaAsync(string udid, UpdateDeviceRequest request, CancellationToken ct = default)
    {
        var device = await _db.Devices.FirstOrDefaultAsync(d => d.Udid == udid, ct)
            ?? throw new KeyNotFoundException($"Device '{udid}' not found.");

        if (request.Tags is not null) device.Tags = request.Tags;
        if (request.Notes is not null) device.Notes = request.Notes;

        await _db.SaveChangesAsync(ct);
        return DeviceDto.FromEntity(device);
    }

    public async Task<PagedResult<SessionLogDto>> GetSessionLogAsync(string udid, PaginationQuery pagination, CancellationToken ct = default)
    {
        var device = await _db.Devices.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Udid == udid, ct)
            ?? throw new KeyNotFoundException($"Device '{udid}' not found.");

        var query = _db.DeviceSessionLogs.AsNoTracking()
            .Where(l => l.DeviceId == device.Id);

        var total = await query.CountAsync(ct);
        var data = await query
            .OrderByDescending(l => l.OccurredAt)
            .Skip(pagination.Skip)
            .Take(pagination.PageSize)
            .Select(l => new SessionLogDto(l.Id, l.Event, l.OldState, l.NewState, l.OccurredAt))
            .ToListAsync(ct);

        return PagedResult<SessionLogDto>.From(data, total, pagination.Page, pagination.PageSize);
    }

    public async Task<IReadOnlyList<DeviceAccountDto>> GetLinkedAccountsAsync(string udid, CancellationToken ct = default)
    {
        var device = await _db.Devices.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Udid == udid, ct)
            ?? throw new KeyNotFoundException($"Device '{udid}' not found.");

        return await _db.DeviceAccounts
            .AsNoTracking()
            .Include(da => da.Account).ThenInclude(a => a.Platform)
            .Where(da => da.DeviceId == device.Id && da.UnassignedAt == null)
            .Select(da => new DeviceAccountDto(
                da.Id, da.AccountId,
                da.Account.Username, da.Account.DisplayName,
                da.Account.PlatformId, da.Account.Platform.DisplayName,
                da.Account.Status, da.AssignedAt))
            .ToListAsync(ct);
    }

    public async Task<DeviceAccountDto> LinkAccountAsync(string udid, int accountId, int assignedByUserId, CancellationToken ct = default)
    {
        var device = await _db.Devices.FirstOrDefaultAsync(d => d.Udid == udid, ct)
            ?? throw new KeyNotFoundException($"Device '{udid}' not found.");

        var account = await _db.Accounts.Include(a => a.Platform)
            .FirstOrDefaultAsync(a => a.Id == accountId, ct)
            ?? throw new KeyNotFoundException($"Account {accountId} not found.");

        var existing = await _db.DeviceAccounts
            .FirstOrDefaultAsync(da => da.DeviceId == device.Id && da.AccountId == accountId && da.UnassignedAt == null, ct);

        if (existing is not null)
            throw new InvalidOperationException($"Account {accountId} is already linked to device '{udid}'.");

        var link = new DeviceAccount
        {
            DeviceId = device.Id,
            AccountId = accountId,
            AssignedBy = assignedByUserId,
            AssignedAt = DateTime.UtcNow,
        };

        _db.DeviceAccounts.Add(link);
        await _db.SaveChangesAsync(ct);

        return new DeviceAccountDto(
            link.Id, account.Id,
            account.Username, account.DisplayName,
            account.PlatformId, account.Platform.DisplayName,
            account.Status, link.AssignedAt);
    }

    public async Task UnlinkAccountAsync(string udid, int accountId, CancellationToken ct = default)
    {
        var device = await _db.Devices.FirstOrDefaultAsync(d => d.Udid == udid, ct)
            ?? throw new KeyNotFoundException($"Device '{udid}' not found.");

        var link = await _db.DeviceAccounts
            .FirstOrDefaultAsync(da => da.DeviceId == device.Id && da.AccountId == accountId && da.UnassignedAt == null, ct)
            ?? throw new KeyNotFoundException($"No active link between device '{udid}' and account {accountId}.");

        link.UnassignedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}
