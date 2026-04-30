using Microsoft.EntityFrameworkCore;
using PhoneFarm.Application.Dashboard.Dtos;
using PhoneFarm.Infrastructure.Data;

namespace PhoneFarm.Application.Dashboard.Services;

public interface IDashboardService
{
    Task<DashboardStatsDto> GetStatsAsync(CancellationToken ct = default);
}

public class DashboardService : IDashboardService
{
    private readonly PhoneFarmDbContext _db;

    public DashboardService(PhoneFarmDbContext db) => _db = db;

    public async Task<DashboardStatsDto> GetStatsAsync(CancellationToken ct = default)
    {
        var totalDevices  = await _db.Devices.CountAsync(ct);
        var onlineDevices = await _db.Devices.CountAsync(d => d.State == "device" || d.State == "Connected", ct);
        var totalAgents   = await _db.Agents.CountAsync(ct);
        var onlineAgents  = await _db.Agents.CountAsync(a => a.IsOnline, ct);
        var totalAccounts = await _db.Accounts.CountAsync(ct);

        var perPlatform = await _db.Platforms
            .AsNoTracking()
            .Select(p => new PlatformAccountCount(
                p.DisplayName,
                p.Accounts.Count,
                p.Accounts.Count(a => a.Status == "active")))
            .ToListAsync(ct);

        return new DashboardStatsDto(
            totalDevices,
            onlineDevices,
            totalDevices - onlineDevices,
            totalAgents,
            onlineAgents,
            totalAccounts,
            perPlatform);
    }
}
