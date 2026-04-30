using Microsoft.EntityFrameworkCore;
using PhoneFarm.Application.Platforms.Dtos;
using PhoneFarm.Infrastructure.Data;

namespace PhoneFarm.Application.Platforms.Services;

public interface IPlatformService
{
    Task<IReadOnlyList<PlatformDto>> GetAllAsync(CancellationToken ct = default);
}

public class PlatformService : IPlatformService
{
    private readonly PhoneFarmDbContext _db;

    public PlatformService(PhoneFarmDbContext db) => _db = db;

    public async Task<IReadOnlyList<PlatformDto>> GetAllAsync(CancellationToken ct = default) =>
        await _db.Platforms
            .AsNoTracking()
            .OrderBy(p => p.DisplayName)
            .Select(p => new PlatformDto(p.Id, p.Name, p.DisplayName, p.Url))
            .ToListAsync(ct);
}
